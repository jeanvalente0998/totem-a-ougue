
const { obterConexao } = require("./oracle");
const oracledb = require("oracledb");

// Consulta os produtos disponíveis para o totem.
async function consultarProdutos() {
  let conexao;

  try {
    // Abre a conexão com o Oracle.
    conexao = await obterConexao();

    const sql = `
      SELECT
        A.CODPROD,
        A.DESCRICAO,
        A.DIRFOTOPROD,
        E.CODAUXILIAR,
        E.UNIDADE,
        (
          F.QTESTGER
          - F.QTBLOQUEADA
          - F.QTINDENIZ
          - F.QTRESERV
        ) AS EST_LIQUIDO,
        E.PVENDA
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

      WHERE A.CODEPTO = 12
        AND A.DTEXCLUSAO IS NULL

        -- Somente produtos com estoque líquido positivo.
        AND (
          F.QTESTGER
          - F.QTBLOQUEADA
          - F.QTINDENIZ
          - F.QTRESERV
        ) > 0

        -- Somente embalagens válidas vendidas por quilo.
        AND E.UNIDADE = 'KG'
        AND E.EXCLUIDO = 'N'
        AND E.PVENDA > 0

        -- Seleciona o código auxiliar com 6 dígitos.
        AND LENGTH(TRIM(TO_CHAR(E.CODAUXILIAR))) = 6

        -- Exclui produtos da subcategoria PERDA.
        AND UPPER(TRIM(S.SUBCATEGORIA)) <> 'PERDA'

      ORDER BY A.DESCRICAO
    `;

    // Executa a consulta e retorna cada linha como um objeto.
    const resultado = await conexao.execute(
      sql,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return resultado.rows;
  } finally {
    // Fecha a conexão mesmo se ocorrer algum erro.
    if (conexao) {
      await conexao.close();
    }
  }
}

module.exports = { consultarProdutos };