
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

        -- Define se o produto pode ser adicionado ao pedido.
        NVL(TRIM(A.ENVIA_TOTEM), 'S') AS ENVIA_TOTEM,

        E.CODAUXILIAR,
        E.UNIDADE,
        (
          F.QTESTGER
          - F.QTBLOQUEADA
          - F.QTINDENIZ
          - F.QTRESERV
        ) AS EST_LIQUIDO,
        
        COALESCE(PROMO.VLOFERTA, E.PVENDA) AS PVENDA,

        -- Tipos de corte disponíveis para o produto.
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

       
      -- Relaciona os cortes disponíveis ao produto.
      LEFT JOIN HOMOLOGA.CF_PRODUTOS_CORTES C
        ON C.CODPROD = A.CODPROD

      JOIN HOMOLOGA.PCEST F
        ON F.CODPROD = A.CODPROD
       AND F.CODFILIAL = 61

      JOIN HOMOLOGA.PCEMBALAGEM E
        ON E.CODPROD = A.CODPROD
       AND E.CODFILIAL = '61'

      -- Busca uma oferta programada vigente por produto.
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

                -- Oferta dentro do período de vigência.
                AND TRUNC(SYSDATE) BETWEEN TRUNC(C.DTINICIAL)
                                      AND TRUNC(C.DTFINAL)

                -- Oferta não cancelada.
                AND C.DTCANCEL IS NULL

                -- Produto não excluído da oferta.
                AND I.DATAEXCLUSAO IS NULL

                -- Preço promocional válido.
                AND I.VLOFERTA > 0
          ) OFERTAS

          WHERE OFERTAS.RN = 1
      ) PROMO
          ON PROMO.CODPROD = A.CODPROD

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
        AND (E.EXCLUIDO  IS NULL OR E.EXCLUIDO = 'N')
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