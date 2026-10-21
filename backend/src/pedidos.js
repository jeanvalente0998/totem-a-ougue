
const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");

const {
    obterConexao,
    consultarClientePorCpf,
} = require("./database/oracle");

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
                
E.PVENDA,
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
                status: "AGUARDANDO_SEPARACAO",
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
                    SUBTOTAL
                ) VALUES (
                    HOMOLOGA.SEQ_CF_TOTEM_PEDIDO_ITEM.NEXTVAL,
                    :idPedido,
                    :codprod,
                    :descricao,
                    :quantidade,
                    :unidade,
                    :precoUnitario,
                    :subtotal
                )`,
                {
                    idPedido,
                    codprod: item.codprod,
                    descricao: item.descricao,
                    quantidade: item.quantidade,
                    unidade: item.unidade,
                    precoUnitario: item.precoUnitario,
                    subtotal: item.subtotal,
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
                status: "AGUARDANDO_SEPARACAO",
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

module.exports = router;