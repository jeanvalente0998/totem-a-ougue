
const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");

const {
    obterConexao,
    consultarClientePorCpf,
} = require("./database/oracle");

const {
    atualizarStatusPedido,
    avancarPedidoPorScanner,
} = require("./database/pedidos");


// Proteção inicial contra leituras duplicadas.
// Adequada para testes com uma única instância do Node.js.
const intervaloSegurancaScanner = 60000;

const ultimasLeiturasScanner = new Map();
const pedidosScannerEmProcessamento = new Set();


// Colunas que representam os tipos de corte no Oracle.
const CAMPOS_CORTES = [
    "BIFE",
    "MANTA",
    "PEDACO",
    "MOIDO",
    "STROGONOFF",
    "RIPA_PICADA",
    "MINGA_MANTA",
    "MINGA_PEDACO",
    "PICADO",
    "FATIADO",
    "PECA",
    "INTEIRO",
    "A_PASSARINHO",
];

// Recebe e grava um pedido do totem no Oracle.
router.post("/", async (req, res) => {
    let conexao;
    let transacaoIniciada = false;

    try {
        const { cpf, itens } = req.body;

        // 1. Validar os dados recebidos do frontend.
        if (
            typeof cpf !== "string" ||
            !/^\d{11}$/.test(cpf) ||
            !Array.isArray(itens) ||
            itens.length === 0
        ) {
            return res.status(400).json({
                mensagem: "Informe um CPF válido e pelo menos um item.",
            });
        }

        const itensValidos = itens.every((item) =>
            Number.isInteger(item.idProduto) &&
            item.idProduto > 0 &&
            Number.isFinite(item.quantidade) &&
            item.quantidade > 0
        );

        if (!itensValidos) {
            return res.status(400).json({
                mensagem: "Um ou mais itens possuem dados inválidos.",
            });
        }

        // 2. Confirmar que o cliente pertence ao Club.
        const cliente = await consultarClientePorCpf(cpf);

        if (!cliente) {
            return res.status(404).json({
                mensagem: "Cliente não encontrado.",
            });
        }

        if (
            String(cliente.CLICRM ?? "").trim().toUpperCase() !== "S"
        ) {
            return res.status(403).json({
                mensagem: "Somente clientes do Club podem fazer pedidos.",
            });
        }

        // 3. Abrir conexão e iniciar a transação.
        conexao = await obterConexao();
        transacaoIniciada = true;

        // 4. Consultar os produtos e os preços diretamente no Oracle.
        const codigos = [...new Set(itens.map((item) => item.idProduto))];

        const binds = {};
        const parametrosIN = codigos.map((codigo, indice) => {
            const nomeBind = `produto${indice}`;
            binds[nomeBind] = codigo;
            return `:${nomeBind}`;
        }).join(", ");

        const sqlProdutos = `
            SELECT
                A.CODPROD,
                A.DESCRICAO,
                E.UNIDADE,
                
                COALESCE(PROMO.VLOFERTA, E.PVENDA) AS PVENDA,
                (
                    F.QTESTGER
                    - F.QTBLOQUEADA
                    - F.QTINDENIZ
                    - F.QTRESERV
                ) AS EST_LIQUIDO,

                -- Cortes permitidos para o produto.
                C.BIFE,
                C.MANTA,
                C.PEDACO,
                C.MOIDO,
                C.STROGONOFF,
                C.RIPA_PICADA,
                C.MINGA_MANTA,
                C.MINGA_PEDACO,
                C.PICADO,
                C.FATIADO,
                C.PECA,
                C.INTEIRO,
                C.A_PASSARINHO

            FROM HOMOLOGA.PCPRODUT A
            
            LEFT JOIN HOMOLOGA.CF_PRODUTOS_CORTES C
                ON C.CODPROD = A.CODPROD

            JOIN HOMOLOGA.PCSUBCATEGORIA S
                ON S.CODSUBCATEGORIA = A.CODSUBCATEGORIA
               AND S.CODSEC = A.CODSEC
               AND S.CODCATEGORIA = A.CODCATEGORIA
            JOIN HOMOLOGA.PCEST F
                ON F.CODPROD = A.CODPROD
               AND F.CODFILIAL = 61
            JOIN HOMOLOGA.PCEMBALAGEM E
                ON E.CODPROD = A.CODPROD
               AND E.CODFILIAL = '61'
            -- Consulta as ofertas programadas vigentes no WinThor.
            LEFT JOIN (
                SELECT
                    OFERTAS.CODPROD,
                    OFERTAS.VLOFERTA
                FROM (
                    SELECT
                        I.CODPROD,
                        I.VLOFERTA,

                        ROW_NUMBER() OVER (
                            PARTITION BY I.CODPROD
                            ORDER BY
                                C.PRIORIDADEOFERTA DESC NULLS LAST,
                                C.DTINICIAL DESC,
                                C.CODOFERTA DESC,
                                I.CODITEM DESC
                        ) AS RN

                    FROM HOMOLOGA.PCOFERTAPROGRAMADAC C

                    INNER JOIN HOMOLOGA.PCOFERTAPROGRAMADAI I
                        ON I.CODOFERTA = C.CODOFERTA
                    AND I.CODFILIAL = C.CODFILIAL

                    WHERE C.CODFILIAL = '61'

                    -- Verifica o período de vigência.
                    AND TRUNC(SYSDATE) BETWEEN TRUNC(C.DTINICIAL)
                                            AND TRUNC(C.DTFINAL)

                    -- Desconsidera ofertas canceladas.
                    AND C.DTCANCEL IS NULL

                    -- Desconsidera itens excluídos.
                    AND I.DATAEXCLUSAO IS NULL

                    -- Considera somente preços positivos.
                    AND I.VLOFERTA > 0
                ) OFERTAS
                WHERE OFERTAS.RN = 1
            ) PROMO
                ON PROMO.CODPROD = A.CODPROD
            WHERE A.CODPROD IN (${parametrosIN})
              AND A.CODEPTO = 12
              AND A.DTEXCLUSAO IS NULL
              AND (
                    F.QTESTGER
                    - F.QTBLOQUEADA
                    - F.QTINDENIZ
                    - F.QTRESERV
                  ) > 0
              AND E.UNIDADE = 'KG'
              AND (E.EXCLUIDO  IS NULL OR E.EXCLUIDO = 'N')
              AND E.PVENDA > 0
              AND LENGTH(TRIM(TO_CHAR(E.CODAUXILIAR))) = 6
              AND UPPER(TRIM(S.SUBCATEGORIA)) <> 'PERDA'
        `;

        const resultadoProdutos = await conexao.execute(
            sqlProdutos,
            binds,
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const produtos = resultadoProdutos.rows;

        // Evitar gravar produtos que não estejam disponíveis.
        if (produtos.length !== codigos.length) {
            await conexao.rollback();
            transacaoIniciada = false;

            return res.status(400).json({
                mensagem:
                    "Um ou mais produtos não estão disponíveis para venda.",
            });
        }

        const produtosPorCodigo = new Map(
            produtos.map((produto) => [produto.CODPROD, produto])
        );


        // Valida os cortes de todos os itens antes de gravar o pedido.
        for (const item of itens) {
            const produto = produtosPorCodigo.get(item.idProduto);

            const cortesPermitidos = CAMPOS_CORTES.filter(
                (campo) =>
                    String(produto[campo] ?? "")
                        .trim()
                        .toUpperCase() === "S"
            );

            const corteSelecionado =
                typeof item.corteSelecionado === "string"
                    ? item.corteSelecionado.trim().toUpperCase()
                    : "";

            // Se existem cortes disponíveis, a seleção é obrigatória.
            if (
                cortesPermitidos.length > 0 &&
                !cortesPermitidos.includes(corteSelecionado)
            ) {
                await conexao.rollback();
                transacaoIniciada = false;

                return res.status(400).json({
                    mensagem:
                        `Selecione um tipo de corte válido para ${produto.DESCRICAO}.`,
                });
            }

            // Produtos sem cortes cadastrados não devem receber um corte.
            if (
                cortesPermitidos.length === 0 &&
                corteSelecionado !== ""
            ) {
                await conexao.rollback();
                transacaoIniciada = false;

                return res.status(400).json({
                    mensagem:
                        `O produto ${produto.DESCRICAO} não possui cortes disponíveis.`,
                });
            }
        }


        // 5. Calcular os valores usando os preços do Oracle.
        const itensCalculados = itens.map((item) => {
            const produto = produtosPorCodigo.get(item.idProduto);

            if (!produto) {
                throw new Error("Produto não encontrado.");
            }

            const precoUnitario = Number(produto.PVENDA);
            const quantidade = Number(item.quantidade);
            const subtotal = Math.round(
                quantidade * precoUnitario * 100
            ) / 100;


            return {
                codprod: produto.CODPROD,
                descricao: produto.DESCRICAO,
                quantidade,
                unidade: produto.UNIDADE,
                precoUnitario,
                subtotal,

                // Guarda o corte para inserir no Oracle.
                tipoCorte: item.corteSelecionado
                    ? item.corteSelecionado.trim().toUpperCase()
                    : null,
            };

        });

        const valorTotal = Math.round(
            itensCalculados.reduce(
                (total, item) => total + item.subtotal,
                0
            ) * 100
        ) / 100;

        // 6. Gerar um identificador para o pedido.
        const resultadoId = await conexao.execute(
            `SELECT HOMOLOGA.SEQ_CF_TOTEM_PEDIDO.NEXTVAL AS ID_PEDIDO
             FROM DUAL`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const idPedido = resultadoId.rows[0].ID_PEDIDO;

        // 7. Gerar a senha diária com base nos pedidos do dia.
        // Atenção: esta versão inicial ainda precisa de proteção
        // contra pedidos simultâneos para evitar senhas duplicadas.
        const resultadoSenha = await conexao.execute(
            `SELECT NVL(MAX(SENHA), 0) + 1 AS PROXIMA_SENHA
             FROM HOMOLOGA.CF_TOTEM_PEDIDO
             WHERE DATA_SENHA = TRUNC(SYSDATE)`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const senha = resultadoSenha.rows[0].PROXIMA_SENHA;

        if (senha > 999999) {
            throw new Error("Limite diário de senhas atingido.");
        }

        // 8. Gravar o cabeçalho do pedido.
        await conexao.execute(
            `INSERT INTO HOMOLOGA.CF_TOTEM_PEDIDO (
                ID_PEDIDO,
                CODCLI,
                SENHA,
                DATA_PEDIDO,
                STATUS,
                VALOR_TOTAL,
                DATA_SENHA
            ) VALUES (
                :idPedido,
                :codcli,
                :senha,
                SYSTIMESTAMP,
                :status,
                :valorTotal,
                TRUNC(SYSDATE)
            )`,
            {
                idPedido,
                codcli: cliente.CODCLI,
                senha,
                status: "AGUARDANDO_PREPARACAO",
                valorTotal,
            }
        );

        // 9. Gravar cada item relacionado ao pedido.
        for (const item of itensCalculados) {

            await conexao.execute(
                `INSERT INTO HOMOLOGA.CF_TOTEM_PEDIDO_ITEM (
                    ID_ITEM,
                    ID_PEDIDO,
                    CODPROD,
                    DESCRICAO_PRODUTO,
                    QUANTIDADE,
                    UNIDADE_MEDIDA,
                    PRECO_UNITARIO,
                    SUBTOTAL,
                    TIPO_CORTE
                ) VALUES (
                    HOMOLOGA.SEQ_CF_TOTEM_PEDIDO_ITEM.NEXTVAL,
                    :idPedido,
                    :codprod,
                    :descricao,
                    :quantidade,
                    :unidade,
                    :precoUnitario,
                    :subtotal,
                    :tipoCorte
                )`,
                {
                    idPedido,
                    codprod: item.codprod,
                    descricao: item.descricao,
                    quantidade: item.quantidade,
                    unidade: item.unidade,
                    precoUnitario: item.precoUnitario,
                    subtotal: item.subtotal,
                    tipoCorte: item.tipoCorte,
                }
            );

        }

        // 10. Confirmar tudo somente depois de inserir os itens.
        await conexao.commit();
        transacaoIniciada = false;

        return res.status(201).json({
            mensagem: "Pedido gravado com sucesso.",
            pedido: {
                pedidoId: idPedido,
                senha: String(senha).padStart(3, "0"),
                codcli: cliente.CODCLI,
                nomeCliente: cliente.CLIENTE,
                itens: itensCalculados,
                valorTotal,
                status: "AGUARDANDO_PREPARACAO",
            },
        });

    } catch (erro) {
        if (conexao && transacaoIniciada) {
            try {
                await conexao.rollback();
            } catch (erroRollback) {
                console.error("Erro no rollback:", erroRollback.message);
            }
        }

        console.error("Erro ao gravar pedido:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível gravar o pedido.",
        });

    } finally {
        if (conexao) {
            try {
                await conexao.close();
            } catch (erroFechamento) {
                console.error(
                    "Erro ao fechar conexão:",
                    erroFechamento.message
                );
            }
        }
    }
});


/**
 * Recebe o código de barras e avança o pedido
 * automaticamente para a próxima etapa.
 */
router.post("/scan", async (req, res) => {
    let idPedido;
    let bloqueioAdquirido = false;

    try {
        const { codigo } = req.body ?? {};

        if (typeof codigo !== "string") {
            return res.status(400).json({
                mensagem: "Código de barras inválido.",
            });
        }

        const correspondencia =
            /^PED-([1-9]\d*)$/.exec(codigo.trim().toUpperCase());

        if (!correspondencia) {
            return res.status(400).json({
                mensagem: "Formato de código de barras inválido.",
            });
        }

        idPedido = Number(correspondencia[1]);

        if (!Number.isSafeInteger(idPedido)) {
            return res.status(400).json({
                mensagem: "Identificador do pedido inválido.",
            });
        }

        const agora = Date.now();
        const ultimaLeitura =
            ultimasLeiturasScanner.get(idPedido) ?? 0;

        // Impede leituras repetidas em intervalo curto.
        if (agora - ultimaLeitura < intervaloSegurancaScanner) {
            return res.status(409).json({
                mensagem:
                    "Leitura repetida. Aguarde antes de escanear novamente.",
                pedidoId: idPedido,
            });
        }

        // Impede duas requisições simultâneas neste processo.
        if (pedidosScannerEmProcessamento.has(idPedido)) {
            return res.status(409).json({
                mensagem: "Este pedido já está sendo processado.",
                pedidoId: idPedido,
            });
        }

        pedidosScannerEmProcessamento.add(idPedido);
        bloqueioAdquirido = true;

        // Verifica novamente após adquirir o bloqueio.
        const ultimaLeituraConfirmada =
            ultimasLeiturasScanner.get(idPedido) ?? 0;

        if (
            Date.now() - ultimaLeituraConfirmada <
            intervaloSegurancaScanner
        ) {
            return res.status(409).json({
                mensagem: "Leitura repetida. Aguarde para tentar novamente.",
                pedidoId: idPedido,
            });
        }

        const resultado = await avancarPedidoPorScanner(idPedido);

        if (resultado.resultado === "NAO_ENCONTRADO") {
            return res.status(404).json({
                mensagem: "Pedido não encontrado.",
            });
        }

        if (resultado.resultado === "SEM_TRANSICAO") {
            return res.status(409).json({
                mensagem: "O pedido não possui uma próxima etapa disponível.",
                pedidoId: idPedido,
                status: resultado.statusAnterior,
            });
        }

        ultimasLeiturasScanner.set(idPedido, Date.now());

        return res.status(200).json({
            mensagem: "Status atualizado pelo scanner com sucesso.",
            pedidoId: idPedido,
            statusAnterior: resultado.statusAnterior,
            status: resultado.novoStatus,
        });

    } catch (erro) {
        console.error("Erro ao processar leitura do scanner:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível processar o código de barras.",
        });

    } finally {
        if (bloqueioAdquirido) {
            pedidosScannerEmProcessamento.delete(idPedido);
        }
    }
});

// Atualiza o status de preparação de um pedido.
router.patch("/:id/status", async (req, res) => {
    try {
        const idPedido = Number(req.params.id);
        const { status } = req.body ?? {};

        // Valida o identificador do pedido.
        if (!Number.isSafeInteger(idPedido) || idPedido <= 0) {
            return res.status(400).json({
                mensagem: "Identificador do pedido inválido.",
            });
        }

        // Aceita somente os próximos status previstos.
        const statusPermitidos = [
            "EM_PREPARACAO",
            "PRONTO_RETIRADA",
        ];

        if (!statusPermitidos.includes(status)) {
            return res.status(400).json({
                mensagem: "Status informado é inválido.",
            });
        }

        // Executa a atualização condicional no Oracle.
        const atualizado = await atualizarStatusPedido(
            idPedido,
            status
        );

        if (!atualizado) {
            return res.status(409).json({
                mensagem:
                    "Pedido não encontrado ou não está na etapa esperada.",
            });
        }

        return res.status(200).json({
            mensagem: "Status atualizado com sucesso.",
            pedidoId: idPedido,
            status,
        });

    } catch (erro) {
        console.error("Erro ao atualizar status do pedido:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível atualizar o status do pedido.",
        });
    }
});


module.exports = router;