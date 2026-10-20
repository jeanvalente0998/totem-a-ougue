
const oracledb = require("oracledb");

oracledb.initOracleClient({
  libDir: "C:\\oracle\\instantclient_19",
});

// Abre uma conexão com o Oracle.
async function obterConexao() {
  return await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  });
}

// Testa a conexão com o banco.
async function testarConexao() {
  let connection;

  try {
    connection = await obterConexao();

    const resultado = await connection.execute(
      "SELECT 'Conexão com Oracle OK!' AS MENSAGEM FROM DUAL"
    );

    console.log(resultado.rows[0][0]);
  } catch (erro) {
    console.error("Erro ao conectar ao Oracle:", erro.message);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

// Busca um cliente pelo CPF/CNPJ armazenado em CGCENT.
async function consultarClientePorCpf(cpf) {
  let connection;

  try {
    connection = await obterConexao();

    const resultado = await connection.execute(
      `SELECT CODCLI, CLIENTE, CLICRM
       FROM HOMOLOGA.PCCLIENT
       WHERE CGCENT = :cpf`,
      { cpf },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return resultado.rows[0] || null;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = {
  obterConexao,
  testarConexao,
  consultarClientePorCpf,
};