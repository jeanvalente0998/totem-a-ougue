
import logoCompreMix from "./assets/logo-compre-mix.png";
import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Produtos from "./Produtos";
import Gerenciamento from "./Gerenciamento";
import "./App.css";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TelaInicial />} />
        <Route
          path="/gerenciamento"
          element={<Gerenciamento />}
        />
      </Routes>
    </BrowserRouter>
  );
}

function TelaInicial() {
  const [cpf, setCpf] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [cliente, setCliente] = useState(null);
  const [carregando, setCarregando] = useState(false);

  if (cliente) {
    return <Produtos cliente={cliente} />;
  }

  function handleCpfChange(event) {
    const apenasNumeros = event.target.value
      .replace(/\D/g, "")
      .slice(0, 11);

    setCpf(apenasNumeros);
    setMensagem("");
    setCliente(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (cpf.length !== 11) {
      setMensagem("Digite os 11 números do CPF.");
      return;
    }

    setMensagem("");
    setCliente(null);
    setCarregando(true);

    try {
      const resposta = await fetch(
        "http:/api/clientes/validar-cpf",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cpf }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        setMensagem(
          dados.mensagem || "Não foi possível validar o cadastro."
        );
        return;
      }

      setMensagem(dados.mensagem);

      if (dados.autorizado) {
        setCliente({
          ...dados.cliente,
          cpf: cpf.replace(/\D/g, ""),
        });
      }
    } catch {
      setMensagem(
        "Não foi possível conectar ao servidor. Tente novamente."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="totem">
      <header className="cabecalho">
        <div className="titulo-cabecalho">
          <h1>
            Auto atendimento
            <span>Açougue</span>
          </h1>
        </div>

        <div className="marca">
          <img
            src={logoCompreMix}
            alt="Compre Mix"
            className="logo-compre-mix"
          />
        </div>
      </header>

      <section className="conteudo">
        <div className="painel">
          <h2>Vamos começar?</h2>

          <p className="descricao">
            Informe seu CPF para começar seu pedido.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="cpf">
              Digite somente os números do seu CPF
            </label>

            <input
              id="cpf"
              type="text"
              inputMode="numeric"
              placeholder="00000000000"
              value={cpf}
              onChange={handleCpfChange}
              maxLength={11}
              autoComplete="off"
              required
              disabled={carregando || Boolean(cliente)}
              aria-describedby="ajuda-cpf"
            />

            <p id="ajuda-cpf" className="ajuda">
              Para realizar seu pedido é necessário ser cadastrado no Clube de Vantagens.
            </p>

            <button
              className="botao-continuar"
              type="submit"
              disabled={carregando || Boolean(cliente)}
            >
              {carregando ? "Consultando cadastro..." : "Continuar"}
              {!carregando && <span aria-hidden="true"> →</span>}
            </button>
          </form>

          {mensagem && (
            <div
              className={`mensagem ${cliente ? "mensagem-sucesso" : "mensagem-erro"
                }`}
              role="status"
              aria-live="polite"
            >
              {mensagem}
            </div>
          )}

          {cliente && (
            <div className="cliente">
              <p className="cliente-etiqueta">CLIENTE IDENTIFICADO</p>
              <h3>Olá, {cliente.nome}!</h3>
              <p>Você está autorizado a utilizar o totem.</p>
            </div>
          )}
        </div>

        <footer className="rodape"></footer>
      </section>
    </main>
  );
}

export default App;