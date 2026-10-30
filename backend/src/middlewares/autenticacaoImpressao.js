const crypto = require("node:crypto");

function autenticarImpressao(req, res, next) {
    const tokenConfigurado = process.env.IMPRESSAO_API_TOKEN;

    if (!tokenConfigurado) {
        console.error("IMPRESSAO_API_TOKEN não configurado.");

        return res.status(503).json({
            mensagem: "Serviço de impressão não configurado.",
        });
    }

    const autorizacao = req.headers.authorization || "";
    const correspondencia = /^Bearer (.+)$/i.exec(autorizacao);

    if (!correspondencia) {
        return res.status(401).json({
            mensagem: "Autenticação necessária.",
        });
    }

    const tokenRecebido = correspondencia[1];

    const esperado = crypto.createHash("sha256")
        .update(tokenConfigurado)
        .digest();

    const recebido = crypto.createHash("sha256")
        .update(tokenRecebido)
        .digest();

    if (!crypto.timingSafeEqual(esperado, recebido)) {
        return res.status(401).json({
            mensagem: "Token de autenticação inválido.",
        });
    }

    next();
}

module.exports = { autenticarImpressao };