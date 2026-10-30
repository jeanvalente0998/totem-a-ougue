const oracledb = require("oracledb");
const { obterConexao } = require("./oracle");

// Consulta as comandas que aguardam impressão.
async function consultarImpressoesPendentes() {
    let conexao;

    try {
        conexao = await obterConexao();

        const resultado = await conexao.execute(
            `SELECT
                P.ID_PEDIDO,
                P.SENHA,
                P.DATA_PEDIDO,
                P.STATUS_IMPRESSAO,
                P.TENTATIVAS_IMPRESSAO
             FROM HOMOLOGA.CF_TOTEM_PEDIDO P
             WHERE P.STATUS_IMPRESSAO = 'PENDENTE'
             ORDER BY P.DATA_PEDIDO ASC, P.ID_PEDIDO ASC
             FETCH FIRST 20 ROWS ONLY`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return resultado.rows;
    } finally {
        if (conexao) {
            await conexao.close();
        }
    }
}

const crypto = require("node:crypto");

// Reserva uma comanda de forma atômica no Oracle.
async function reservarImpressao(idPedido) {
    let conexao;

    try {
        conexao = await obterConexao();

        // Token exclusivo para esta tentativa de impressão.
        const token = crypto.randomUUID();

        const resultado = await conexao.execute(
            `UPDATE HOMOLOGA.CF_TOTEM_PEDIDO
             SET
                 STATUS_IMPRESSAO = 'PROCESSANDO',
                 TOKEN_IMPRESSAO = :token,
                 DATA_RESERVA_IMPRESSAO = SYSTIMESTAMP,
                 TENTATIVAS_IMPRESSAO =
                     NVL(TENTATIVAS_IMPRESSAO, 0) + 1,
                 ERRO_IMPRESSAO = NULL
             WHERE ID_PEDIDO = :idPedido
               AND STATUS_IMPRESSAO = 'PENDENTE'`,
            {
                token,
                idPedido,
            },
            { autoCommit: false }
        );

        // Outro dispositivo já reservou ou processou o pedido.
        if (resultado.rowsAffected !== 1) {
            await conexao.rollback();
            return null;
        }

        await conexao.commit();

        return {
            idPedido,
            token,
            status: "PROCESSANDO",
        };
    } catch (erro) {
        if (conexao) {
            await conexao.rollback();
        }

        throw erro;
    } finally {
        if (conexao) {
            await conexao.close();
        }
    }
}

// Confirma o envio da comanda à impressora.
async function confirmarImpressao(idPedido, token) {
    let conexao;

    try {
        conexao = await obterConexao();

        const resultado = await conexao.execute(
            `UPDATE HOMOLOGA.CF_TOTEM_PEDIDO
             SET
                 STATUS_IMPRESSAO = 'ENVIADA',
                 DATA_IMPRESSAO = SYSTIMESTAMP,
                 TOKEN_IMPRESSAO = NULL,
                 DATA_RESERVA_IMPRESSAO = NULL,
                 ERRO_IMPRESSAO = NULL
             WHERE ID_PEDIDO = :idPedido
               AND STATUS_IMPRESSAO = 'PROCESSANDO'
               AND TOKEN_IMPRESSAO = :token`,
            { idPedido, token },
            { autoCommit: false }
        );

        if (resultado.rowsAffected !== 1) {
            await conexao.rollback();
            return false;
        }

        await conexao.commit();
        return true;

    } catch (erro) {
        if (conexao) {
            await conexao.rollback();
        }
        throw erro;

    } finally {
        if (conexao) {
            await conexao.close();
        }
    }
}

// Registra uma falha na tentativa de impressão.
async function registrarErroImpressao(idPedido, token, mensagemErro) {
    let conexao;

    try {
        conexao = await obterConexao();

        const resultado = await conexao.execute(
            `UPDATE HOMOLOGA.CF_TOTEM_PEDIDO
             SET
                 STATUS_IMPRESSAO = 'ERRO',
                 ERRO_IMPRESSAO = :mensagemErro,
                 TOKEN_IMPRESSAO = NULL,
                 DATA_RESERVA_IMPRESSAO = NULL
             WHERE ID_PEDIDO = :idPedido
               AND STATUS_IMPRESSAO = 'PROCESSANDO'
               AND TOKEN_IMPRESSAO = :token`,
            {
                idPedido,
                token,
                mensagemErro,
            },
            { autoCommit: false }
        );

        if (resultado.rowsAffected !== 1) {
            await conexao.rollback();
            return false;
        }

        await conexao.commit();
        return true;

    } catch (erro) {
        if (conexao) {
            await conexao.rollback();
        }

        throw erro;

    } finally {
        if (conexao) {
            await conexao.close();
        }
    }
}

// Libera uma comanda com erro para uma nova tentativa.
async function liberarImpressaoComErro(idPedido) {
    let conexao;

    try {
        conexao = await obterConexao();

        const resultado = await conexao.execute(
            `UPDATE HOMOLOGA.CF_TOTEM_PEDIDO
             SET
                 STATUS_IMPRESSAO = 'PENDENTE',
                 ERRO_IMPRESSAO = NULL,
                 TOKEN_IMPRESSAO = NULL,
                 DATA_RESERVA_IMPRESSAO = NULL
             WHERE ID_PEDIDO = :idPedido
               AND STATUS_IMPRESSAO = 'ERRO'`,
            { idPedido },
            { autoCommit: false }
        );

        if (resultado.rowsAffected !== 1) {
            await conexao.rollback();
            return false;
        }

        await conexao.commit();
        return true;

    } catch (erro) {
        if (conexao) {
            await conexao.rollback();
        }

        throw erro;

    } finally {
        if (conexao) {
            await conexao.close();
        }
    }
}

// Consulta comandas que estão em processamento
// há mais de dois minutos.
async function consultarReservasInterrompidas() {
    let conexao;

    try {
        conexao = await obterConexao();

        const resultado = await conexao.execute(
            `SELECT
                ID_PEDIDO,
                SENHA,
                STATUS_IMPRESSAO,
                TENTATIVAS_IMPRESSAO,
                DATA_RESERVA_IMPRESSAO
             FROM HOMOLOGA.CF_TOTEM_PEDIDO
             WHERE STATUS_IMPRESSAO = 'PROCESSANDO'
               AND DATA_RESERVA_IMPRESSAO <
                   SYSTIMESTAMP - INTERVAL '2' MINUTE
             ORDER BY DATA_RESERVA_IMPRESSAO`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return resultado.rows;

    } finally {
        if (conexao) {
            await conexao.close();
        }
    }
}

module.exports = {
    consultarImpressoesPendentes,
    reservarImpressao,
    confirmarImpressao,
    registrarErroImpressao,
    liberarImpressaoComErro,
    consultarReservasInterrompidas,
};