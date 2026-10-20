
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

app.listen(PORT, () => {
    console.log(`Servidor iniciado em http://localhost:${PORT}`);
});