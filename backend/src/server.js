
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pedidosRouter = require("./pedidos");
const { consultarProdutos } = require("./database/produtos");
const { consultarPedidos } = require("./database/pedidos");
const fs = require("fs/promises");

const {
    obterConexao,
    consultarClientePorCpf,
} = require("./database/oracle");

const {
    consultarProdutosGerenciamento,
    atualizarEnviaTotem,
} = require("./database/gerenciamentoProdutos");

const {
    consultarImpressoesPendentes,
    reservarImpressao,
    confirmarImpressao,
    registrarErroImpressao,
    liberarImpressaoComErro,
    consultarReservasInterrompidas,
} = require("./database/impressoes");

const {
    autenticarImpressao
} = require("./middlewares/autenticacaoImpressao");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
// Rotas para criação de pedidos do totem.
app.use("/api/pedidos", pedidosRouter);

// Verifica se a API está funcionando.
app.get("/api/status", (req, res) => {
    res.json({
        funcionando: true,
        mensagem: "API do totem de açougue funcionando!",
    });
});

// Valida se o CPF pertence a um cliente do Club.
app.post("/api/clientes/validar-cpf", async (req, res) => {
    try {
        // Remove pontos, traços, espaços e outros caracteres.
        const cpf = String(req.body.cpf ?? "").replace(/\D/g, "");

        // Verifica se o CPF possui 11 dígitos.
        if (!/^\d{11}$/.test(cpf)) {
            return res.status(400).json({
                autorizado: false,
                mensagem: "Informe um CPF válido com 11 dígitos.",
            });
        }

        // Consulta o cadastro no Oracle.
        const cliente = await consultarClientePorCpf(cpf);

        // CPF não encontrado.
        if (!cliente) {
            return res.status(200).json({
                autorizado: false,
                mensagem:
                    "É necessário ser cadastrado no Clube de Vantagens para utilizar esta funcionalidade.",
            });
        }

        // Verifica se o cliente pertence ao Club.
        const participaClub =
            String(cliente.CLICRM ?? "").trim().toUpperCase() === "S";

        if (!participaClub) {
            return res.status(200).json({
                autorizado: false,
                mensagem:
                    "É necessário ser cadastrado no Clube de Vantagens para utilizar esta funcionalidade.",
            });
        }

        // Cliente autorizado.
        return res.status(200).json({
            autorizado: true,
            cliente: {
                codigo: cliente.CODCLI,
                nome: cliente.CLIENTE,
            },
            mensagem: "Cliente do Club identificado com sucesso!",
        });
    } catch (erro) {
        // Não registra o CPF nem os dados pessoais nos logs.
        console.error("Erro ao validar cliente:", erro.message);

        return res.status(500).json({
            autorizado: false,
            mensagem: "Não foi possível validar o cadastro. Tente novamente.",
        });
    }
});

// Lista os produtos para configuração pelo gerente do açougue.
app.get("/api/gerenciamento-produtos", async (req, res) => {
    try {
        const produtos = await consultarProdutosGerenciamento();

        return res.json({ produtos });

    } catch (erro) {
        console.error(
            "Erro ao consultar produtos do gerenciamento:",
            erro.message
        );

        return res.status(500).json({
            mensagem: "Não foi possível consultar os produtos.",
        });
    }
});

// Atualiza se um produto pode ser adicionado ao pedido no totem.
app.patch("/api/gerenciamento-produtos/:codprod/envia-totem", async (req, res) => {
    try {
        const codprod = Number(req.params.codprod);
        const { enviaTotem } = req.body;

        if (
            !Number.isSafeInteger(codprod) ||
            codprod <= 0 ||
            !["S", "N"].includes(enviaTotem)
        ) {
            return res.status(400).json({
                mensagem: "Código do produto ou configuração inválida.",
            });
        }

        const atualizado = await atualizarEnviaTotem(
            codprod,
            enviaTotem
        );

        if (!atualizado) {
            return res.status(404).json({
                mensagem: "Produto não encontrado ou não permitido.",
            });
        }

        return res.json({
            mensagem: "Configuração atualizada com sucesso.",
            codprod,
            enviaTotem,
        });
    } catch (erro) {
        console.error("Erro ao atualizar ENVIA_TOTEM:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível atualizar o produto.",
        });
    }
});

// Lista os produtos disponíveis para o totem.
app.get("/api/produtos", async (req, res) => {
    try {
        const produtos = await consultarProdutos();

        res.json({ produtos });
    } catch (erro) {
        console.error("Erro ao consultar produtos:", erro.message);

        res.status(500).json({
            mensagem: "Não foi possível consultar os produtos.",
        });
    }
});

// Lista os pedidos registrados no Oracle.
app.get("/api/pedidos", async (req, res) => {
    try {
        const pedidos = await consultarPedidos();

        res.json({ pedidos });
    } catch (erro) {
        console.error("Erro ao consultar pedidos:", erro.message);

        res.status(500).json({
            mensagem: "Não foi possível consultar os pedidos.",
        });
    }
});

// Entrega a imagem de um produto cadastrado no WinThor.
app.get("/api/produtos/imagem/:codprod", async (req, res) => {
    let conexao;

    try {
        const { codprod } = req.params;

        // Aceita somente códigos numéricos de produtos.
        if (!/^\d+$/.test(codprod)) {
            return res.status(400).json({
                mensagem: "Código de produto inválido.",
            });
        }

        conexao = await obterConexao();

        const resultado = await conexao.execute(
            `SELECT DIRFOTOPROD
       FROM HOMOLOGA.PCPRODUT
       WHERE CODPROD = :codprod`,
            { codprod: Number(codprod) }
        );

        const caminho = resultado.rows[0]?.[0];

        if (!caminho) {
            return res.status(404).json({
                mensagem: "Imagem não cadastrada para este produto.",
            });
        }

        const caminhoBase =
            "\\\\192.168.10.8\\WINTHOR\\PRODUTOS\\";

        const caminhoImagem = String(caminho).trim();

        // Permite ler somente imagens da pasta de produtos do WinThor.
        if (
            !caminhoImagem.toUpperCase().startsWith(
                caminhoBase.toUpperCase()
            ) ||
            !/\.(JPG|JPEG|PNG|WEBP)$/i.test(caminhoImagem)
        ) {
            return res.status(403).json({
                mensagem: "Caminho de imagem não permitido.",
            });
        }

        const imagem = await fs.readFile(caminhoImagem);

        res.type(caminhoImagem);
        res.send(imagem);
    } catch (erro) {
        console.error("Erro ao carregar imagem:", erro.message);

        res.status(500).json({
            mensagem: "Não foi possível carregar a imagem.",
        });
    } finally {
        if (conexao) {
            await conexao.close();
        }
    }
});

app.use("/api/impressoes", autenticarImpressao);

// Consulta as comandas pendentes de impressão.
app.get("/api/impressoes/pendentes", async (req, res) => {
    try {
        const impressoes = await consultarImpressoesPendentes();

        return res.json({ impressoes });
    } catch (erro) {
        console.error(
            "Erro ao consultar impressões pendentes:",
            erro.message
        );

        return res.status(500).json({
            mensagem: "Não foi possível consultar as impressões.",
        });
    }
});

// Reserva uma comanda para impressão.
app.post("/api/impressoes/:id/reservar", async (req, res) => {
    try {
        const idPedido = Number(req.params.id);

        if (
            !Number.isSafeInteger(idPedido) ||
            idPedido <= 0
        ) {
            return res.status(400).json({
                mensagem: "Identificador do pedido inválido.",
            });
        }

        const reserva = await reservarImpressao(idPedido);

        if (!reserva) {
            return res.status(409).json({
                mensagem:
                    "Comanda indisponível para reserva.",
            });
        }

        return res.json({
            mensagem: "Comanda reservada com sucesso.",
            reserva,
        });
    } catch (erro) {
        console.error(
            "Erro ao reservar impressão:",
            erro.message
        );

        return res.status(500).json({
            mensagem: "Não foi possível reservar a impressão.",
        });
    }
});

// Confirma que o aplicativo enviou a comanda à impressora.
app.post("/api/impressoes/:id/confirmar", async (req, res) => {
    try {
        const idPedido = Number(req.params.id);
        const { token } = req.body ?? {};

        if (
            !Number.isSafeInteger(idPedido) ||
            idPedido <= 0 ||
            typeof token !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)
        ) {
            return res.status(400).json({
                mensagem: "Pedido ou token inválido.",
            });
        }

        const confirmado = await confirmarImpressao(idPedido, token);

        if (!confirmado) {
            return res.status(409).json({
                mensagem: "Reserva não encontrada ou já finalizada.",
            });
        }

        return res.json({
            mensagem: "Envio da comanda confirmado.",
            pedidoId: idPedido,
            statusImpressao: "ENVIADA",
        });

    } catch (erro) {
        console.error("Erro ao confirmar impressão:", erro.message);

        return res.status(500).json({
            mensagem: "Não foi possível confirmar a impressão.",
        });
    }
});

// Registra uma falha no envio da comanda.
app.post("/api/impressoes/:id/erro", async (req, res) => {
    try {
        const idPedido = Number(req.params.id);
        const { token, mensagem } = req.body ?? {};

        if (
            !Number.isSafeInteger(idPedido) ||
            idPedido <= 0 ||
            typeof token !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token) ||
            typeof mensagem !== "string" ||
            !mensagem.trim() ||
            mensagem.length > 1000
        ) {
            return res.status(400).json({
                mensagem: "Dados da falha inválidos.",
            });
        }

        const registrado = await registrarErroImpressao(
            idPedido,
            token,
            mensagem.trim()
        );

        if (!registrado) {
            return res.status(409).json({
                mensagem: "Reserva não encontrada ou já finalizada.",
            });
        }

        return res.json({
            mensagem: "Falha de impressão registrada.",
            pedidoId: idPedido,
            statusImpressao: "ERRO",
        });

    } catch (erro) {
        console.error(
            "Erro ao registrar falha de impressão:",
            erro.message
        );

        return res.status(500).json({
            mensagem: "Não foi possível registrar a falha.",
        });
    }
});

// Libera uma comanda com erro para nova tentativa.
app.post("/api/impressoes/:id/tentar-novamente", async (req, res) => {
    try {
        const idPedido = Number(req.params.id);

        if (!Number.isSafeInteger(idPedido) || idPedido <= 0) {
            return res.status(400).json({
                mensagem: "Identificador do pedido inválido.",
            });
        }

        const liberado = await liberarImpressaoComErro(idPedido);

        if (!liberado) {
            return res.status(409).json({
                mensagem: "A comanda não está disponível para nova tentativa.",
            });
        }

        return res.json({
            mensagem: "Comanda liberada para nova tentativa.",
            pedidoId: idPedido,
            statusImpressao: "PENDENTE",
        });

    } catch (erro) {
        console.error(
            "Erro ao liberar nova tentativa:",
            erro.message
        );

        return res.status(500).json({
            mensagem: "Não foi possível liberar a comanda.",
        });
    }
});

// Consulta reservas de impressão possivelmente interrompidas.
app.get("/api/impressoes/interrompidas", async (req, res) => {
    try {
        const reservas = await consultarReservasInterrompidas();

        return res.json({
            quantidade: reservas.length,
            reservas,
        });

    } catch (erro) {
        console.error(
            "Erro ao consultar reservas interrompidas:",
            erro.message
        );

        return res.status(500).json({
            mensagem: "Não foi possível consultar as reservas.",
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado em http://localhost:${PORT}`);
});