
const oracledb = require("oracledb");
const { obterConexao } = require("./oracle");

// Consulta os pedidos registrados no banco de dados.
async function consultarPedidos() {
    let conexao;

    try {
        conexao = await obterConexao();

        const sql = `
            SELECT
                P.ID_PEDIDO,
                P.SENHA,
                P.CODCLI,
                P.DATA_PEDIDO,
                P.STATUS,
                P.VALOR_TOTAL,
                I.ID_ITEM,
                I.CODPROD,
                I.DESCRICAO_PRODUTO,
                I.QUANTIDADE,
                I.UNIDADE_MEDIDA,
                I.PRECO_UNITARIO,
                I.SUBTOTAL,
                I.TIPO_CORTE
            FROM HOMOLOGA.CF_TOTEM_PEDIDO P
            LEFT JOIN HOMOLOGA.CF_TOTEM_PEDIDO_ITEM I
                ON I.ID_PEDIDO = P.ID_PEDIDO
            WHERE P.DATA_PEDIDO >= TRUNC(SYSDATE)
            AND P.DATA_PEDIDO < TRUNC(SYSDATE) + 1

            -- Pedidos retirados não aparecem nas telas.
            AND P.STATUS IN (
                'AGUARDANDO_PREPARACAO',
                'EM_PREPARACAO',
                'PRONTO_RETIRADA'
            )

            -- Pedidos prontos desaparecem após 15 minutos.
            AND (
                P.STATUS <> 'PRONTO_RETIRADA'
                OR (
                    P.DATA_PRONTO IS NOT NULL
                    AND P.DATA_PRONTO > LOCALTIMESTAMP - INTERVAL '15' MINUTE
                )
            )
            ORDER BY
                P.DATA_PEDIDO DESC,
                P.ID_PEDIDO DESC,
                I.ID_ITEM
        `;

        const resultado = await conexao.execute(
            sql,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // Retorna os registros encontrados no Oracle.
        return resultado.rows;

    } finally {
        if (conexao) {
            await conexao.close();
        }
    }
}


// Atualiza o status de um pedido respeitando a ordem de preparação.
async function atualizarStatusPedido(idPedido, novoStatus) {
    let conexao;

    const transicoesPermitidas = {
        EM_PREPARACAO: "AGUARDANDO_PREPARACAO",
        PRONTO_RETIRADA: "EM_PREPARACAO",
        RETIRADO_PELO_CLIENTE: "PRONTO_RETIRADA",
    };

    const statusAnterior = transicoesPermitidas[novoStatus];

    if (!statusAnterior) {
        throw new Error("Transição de status inválida.");
    }

    try {
        conexao = await obterConexao();


        const sql = `
            UPDATE HOMOLOGA.CF_TOTEM_PEDIDO
            SET
                STATUS = :novoStatus,

                -- Registra quando o pedido ficou pronto.
                DATA_PRONTO = CASE
                    WHEN :novoStatus = 'PRONTO_RETIRADA'
                    THEN LOCALTIMESTAMP
                    ELSE DATA_PRONTO
                END,

                -- Registra quando o pedido foi retirado.
                DATA_RETIRADA = CASE
                    WHEN :novoStatus = 'RETIRADO_PELO_CLIENTE'
                    THEN LOCALTIMESTAMP
                    ELSE DATA_RETIRADA
                END

            WHERE ID_PEDIDO = :idPedido
            AND STATUS = :statusAnterior
        `;

        const resultado = await conexao.execute(
            sql,
            {
                novoStatus,
                idPedido,
                statusAnterior,
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

/**
 * Avança o pedido para a próxima etapa após leitura
 * do código de barras.
 */
async function avancarPedidoPorScanner(idPedido) {
    let conexao;

    try {
        conexao = await obterConexao();

        // Bloqueia o registro durante a transação.
        const consulta = await conexao.execute(
            `SELECT STATUS
             FROM HOMOLOGA.CF_TOTEM_PEDIDO
             WHERE ID_PEDIDO = :idPedido
             FOR UPDATE`,
            { idPedido },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (consulta.rows.length === 0) {
            await conexao.rollback();

            return {
                resultado: "NAO_ENCONTRADO",
            };
        }

        const statusAnterior = consulta.rows[0].STATUS;

        const transicoes = {
            AGUARDANDO_PREPARACAO: "EM_PREPARACAO",
            EM_PREPARACAO: "PRONTO_RETIRADA",
            PRONTO_RETIRADA: "RETIRADO_PELO_CLIENTE",
        };

        const novoStatus = transicoes[statusAnterior];

        if (!novoStatus) {
            await conexao.rollback();

            return {
                resultado: "SEM_TRANSICAO",
                statusAnterior,
            };
        }

        await conexao.execute(
            `UPDATE HOMOLOGA.CF_TOTEM_PEDIDO
        SET
            STATUS = :novoStatus,

            -- Registra quando o pedido fica pronto.
            DATA_PRONTO = CASE
                WHEN :novoStatus = 'PRONTO_RETIRADA'
                THEN LOCALTIMESTAMP
                ELSE DATA_PRONTO
            END,

            -- Registra quando o cliente retira o pedido.
            DATA_RETIRADA = CASE
                WHEN :novoStatus = 'RETIRADO_PELO_CLIENTE'
                THEN LOCALTIMESTAMP
                ELSE DATA_RETIRADA
            END

        WHERE ID_PEDIDO = :idPedido
        AND STATUS = :statusAnterior`,
            {
                novoStatus,
                idPedido,
                statusAnterior,
            },
            { autoCommit: false }
        );

        await conexao.commit();

        return {
            resultado: "ATUALIZADO",
            statusAnterior,
            novoStatus,
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

async function cancelarPedido(idPedido, codcli) {
    let conexao;

    try {
        conexao = await obterConexao();

        // Atualização condicional e atômica:
        // somente o proprietário pode cancelar um pedido
        // que ainda não foi retirado ou cancelado.
        const resultado = await conexao.execute(
            `UPDATE HOMOLOGA.CF_TOTEM_PEDIDO
             SET
                 STATUS = 'CANCELADO_PELO_CLIENTE',
                 DATA_CANCELAMENTO = LOCALTIMESTAMP
             WHERE ID_PEDIDO = :idPedido
               AND CODCLI = :codcli
               AND STATUS IN (
                   'AGUARDANDO_PREPARACAO',
                   'EM_PREPARACAO',
                   'PRONTO_RETIRADA'
               )`,
            { idPedido, codcli },
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

async function consultarPedidoParaCancelamento(idPedido, codcli) {
    let conexao;

    try {
        conexao = await obterConexao();

        const resultado = await conexao.execute(
            `SELECT
                ID_PEDIDO,
                SENHA,
                VALOR_TOTAL,
                STATUS
             FROM HOMOLOGA.CF_TOTEM_PEDIDO
             WHERE ID_PEDIDO = :idPedido
               AND CODCLI = :codcli
               AND STATUS IN (
                   'AGUARDANDO_PREPARACAO',
                   'EM_PREPARACAO',
                   'PRONTO_RETIRADA'
               )`,
            { idPedido, codcli },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const pedido = resultado.rows[0];

        if (!pedido) {
            return null;
        }

        return {
            idPedido: pedido.ID_PEDIDO,
            senha: pedido.SENHA,
            valorTotal: pedido.VALOR_TOTAL,
            status: pedido.STATUS,
        };

    } finally {
        if (conexao) {
            await conexao.close();
        }
    }
}

// Consulta os cancelamentos ainda não reconhecidos pela equipe.
async function consultarCancelamentosPendentes() {
    let conexao;

    try {
        conexao = await obterConexao();

        const resultado = await conexao.execute(
            `SELECT
                ID_PEDIDO,
                SENHA,
                VALOR_TOTAL,
                DATA_CANCELAMENTO
             FROM HOMOLOGA.CF_TOTEM_PEDIDO
             WHERE STATUS = 'CANCELADO_PELO_CLIENTE'
               AND DATA_CIENCIA_CANCELAMENTO IS NULL
             ORDER BY DATA_CANCELAMENTO ASC, ID_PEDIDO ASC`,
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

// Registra que o funcionário tomou ciência do cancelamento.
async function confirmarCienciaCancelamento(idPedido) {
    let conexao;

    try {
        conexao = await obterConexao();

        const resultado = await conexao.execute(
            `UPDATE HOMOLOGA.CF_TOTEM_PEDIDO
             SET DATA_CIENCIA_CANCELAMENTO = LOCALTIMESTAMP
             WHERE ID_PEDIDO = :idPedido
               AND STATUS = 'CANCELADO_PELO_CLIENTE'
               AND DATA_CIENCIA_CANCELAMENTO IS NULL`,
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
        if (conexao) await conexao.rollback();
        throw erro;

    } finally {
        if (conexao) await conexao.close();
    }
}


module.exports = {
    consultarPedidos,
    atualizarStatusPedido,
    avancarPedidoPorScanner,
    cancelarPedido,
    consultarPedidoParaCancelamento,
    consultarCancelamentosPendentes,
    confirmarCienciaCancelamento,
};