
import logoCompreMix from "./assets/logo-compre-mix.png";
import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Produtos from "./Produtos";
import Gerenciamento from "./Gerenciamento";
import PainelCliente from "./PainelCliente";
import TecladoNumerico from "./TecladoNumerico";
import ModalCancelarPedido from "./ModalCancelarPedido";
import GerenciamentoProdutos from "./GerenciamentoProdutos";
import "./App.css";



function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Tela 1 - Totem de autoatendimento */}
        <Route
          path="/"
          element={<TelaInicial />}
        />

        {/* Tela 2 - Gerenciamento dos pedidos */}
        <Route
          path="/gerenciamento"
          element={<Gerenciamento />}
        />

        {/* Tela 3 - Acompanhamento para clientes */}
        <Route
          path="/painel-cliente"
          element={<PainelCliente />}
        />

        {/* Tela 4 - Gerenciamento de produtos Açougue */}
        <Route
          path="/gerenciamento-produtos"
          element={<GerenciamentoProdutos />}
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
  // CONFIGURAÇÃO DO TECLADO VIRTUAL
  const TECLADO_VIRTUAL_ATIVO = true;
  const [tecladoAberto, setTecladoAberto] = useState(true);
  const [modalCancelamentoAberta, setModalCancelamentoAberta] = useState(false);

  if (cliente) {
    return (
      <Produtos
        cliente={cliente}
        onConcluirAtendimento={() => {
          setCliente(null);
          setCpf("");
          setMensagem("");
          setTecladoAberto(true);
        }}
      />
    );
  }

  function handleCpfChange(event) {
    const apenasNumeros = event.target.value
      .replace(/\D/g, "")
      .slice(0, 11);

    setCpf(apenasNumeros);
    setMensagem("");
    setCliente(null);
  }

  function adicionarNumero(numero) {
    setCpf((cpfAtual) => (cpfAtual + numero).slice(0, 11));
    setMensagem("");
  }

  function apagarNumero() {
    setCpf((cpfAtual) => cpfAtual.slice(0, -1));
    setMensagem("");
  }

  function limparCpf() {
    setCpf("");
    setMensagem("");
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
        "/api/clientes/validar-cpf",
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
      } else {
        setTecladoAberto(true);
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

          <form id="form-cpf" onSubmit={handleSubmit}>
            <label htmlFor="cpf">
              Digite somente os números do seu CPF
            </label>

            <input
              id="cpf"
              type="text"
              inputMode={TECLADO_VIRTUAL_ATIVO ? "none" : "numeric"}
              placeholder="00000000000"
              value={cpf}
              onChange={handleCpfChange}
              onFocus={() => {
                if (TECLADO_VIRTUAL_ATIVO) {
                  setTecladoAberto(true);
                }
              }}
              maxLength={11}
              autoComplete="off"
              required
              disabled={carregando || Boolean(cliente)}
              aria-describedby="ajuda-cpf"
            />

            {TECLADO_VIRTUAL_ATIVO && tecladoAberto && !carregando && (
              <TecladoNumerico
                onNumero={adicionarNumero}
                onApagar={apagarNumero}
                onLimpar={limparCpf}
                onConfirmar={() => {
                  document.getElementById("form-cpf")?.requestSubmit();
                }}
              />
            )}

            <p id="ajuda-cpf" className="ajuda">
              Para realizar seu pedido é necessário ser cadastrado no Clube de Vantagens.
            </p>

          </form>

          <button
            type="button"
            className="botao-cancelar-pedido"
            onClick={() => {
              setModalCancelamentoAberta(true);
              setTecladoAberto(false);
            }}
          >
            Cancelar pedido
          </button>

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
      {modalCancelamentoAberta && (
        <ModalCancelarPedido
          onFechar={() => {
            setModalCancelamentoAberta(false);
            setTecladoAberto(true);
          }}
        />
      )}
    </main>
  );
}

export default App;