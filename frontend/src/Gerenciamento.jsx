
import "./Gerenciamento.css";

function Gerenciamento() {
  return (
    <main className="pagina-gerenciamento">
      <header className="cabecalho-gerenciamento">
        <div>
          <h1>Gerenciamento de Pedidos</h1>
          <p>Painel de controle do açougue</p>
        </div>

        <span className="status-painel">
          Painel do funcionário
        </span>
      </header>

      <section className="conteudo-gerenciamento">
        <h2>Pedidos recebidos</h2>

        <p className="mensagem-vazia">
          Ainda estamos preparando a consulta dos pedidos.
        </p>
      </section>
    </main>
  );
}

export default Gerenciamento;