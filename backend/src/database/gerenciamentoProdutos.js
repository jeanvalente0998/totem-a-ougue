const oracledb = require("oracledb");
const { obterConexao } = require("./oracle");

// Consulta produtos para configuração de retirada no balcão.
async function consultarProdutosGerenciamento() {
    let conexao;

    try {
        conexao = await obterConexao();

        const sql = `
            SELECT
                A.CODPROD,
                A.DESCRICAO,
                A.CODSEC,
                C.DESCRICAO AS SECAO,
                A.CODCATEGORIA,
                D.CATEGORIA,
                A.CODSUBCATEGORIA,
                E.SUBCATEGORIA,
                NVL(TRIM(A.ENVIA_TOTEM), 'S') AS ENVIA_TOTEM,
                F.QTESTGER

            FROM HOMOLOGA.PCPRODUT A

            JOIN HOMOLOGA.PCSECAO C
                ON C.CODSEC = A.CODSEC
               AND C.CODEPTO = A.CODEPTO

            JOIN HOMOLOGA.PCCATEGORIA D
                ON D.CODCATEGORIA = A.CODCATEGORIA
               AND D.CODSEC = A.CODSEC

            JOIN HOMOLOGA.PCSUBCATEGORIA E
                ON E.CODSUBCATEGORIA = A.CODSUBCATEGORIA
               AND E.CODSEC = A.CODSEC
               AND E.CODCATEGORIA = A.CODCATEGORIA

            JOIN HOMOLOGA.PCEST F
                ON F.CODPROD = A.CODPROD
               AND F.CODFILIAL = 61

            WHERE A.CODEPTO = 12
              AND A.DTEXCLUSAO IS NULL
              AND F.QTESTGER > 0

            ORDER BY
                C.DESCRICAO,
                D.CATEGORIA,
                E.SUBCATEGORIA,
                A.DESCRICAO
        `;

        const resultado = await conexao.execute(
            sql,
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

// Atualiza a disponibilidade do produto para pedidos no totem.
async function atualizarEnviaTotem(codprod, enviaTotem) {
    let conexao;

    try {
        conexao = await obterConexao();

        const sql = `
      UPDATE HOMOLOGA.PCPRODUT
      SET ENVIA_TOTEM = :enviaTotem
      WHERE CODPROD = :codprod
        AND CODEPTO = 12
        AND DTEXCLUSAO IS NULL
    `;

        const resultado = await conexao.execute(
            sql,
            {
                codprod,
                enviaTotem,
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

module.exports = {
  consultarProdutosGerenciamento,
  atualizarEnviaTotem,
};