
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

module.exports = {
    consultarPedidos,
};