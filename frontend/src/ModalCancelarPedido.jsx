
import { useState } from "react";
import TecladoNumerico from "./TecladoNumerico";
import "./ModalCancelarPedido.css";

function ModalCancelarPedido({ onFechar }) {
    const [etapa, setEtapa] = useState("cpf");
    const [cpf, setCpf] = useState("");
    const [numeroPedido, setNumeroPedido] = useState("");
    const [mensagem, setMensagem] = useState("");
    const [pedidoEncontrado, setPedidoEncontrado] = useState(null);
    const [consultandoPedido, setConsultandoPedido] = useState(false);
    const [cancelandoPedido, setCancelandoPedido] = useState(false);

    const campoAtual = etapa === "cpf" ? cpf : numeroPedido;
    const limite = etapa === "cpf" ? 11 : 12;

    function alterarCampo(valor) {
        const numeros = valor.replace(/\D/g, "").slice(0, limite);

        if (etapa === "cpf") {
            setCpf(numeros);
        } else {
            setNumeroPedido(numeros);
        }

        setMensagem("");
    }

    function adicionarNumero(numero) {
        alterarCampo(campoAtual + numero);
    }

    function apagarNumero() {
        alterarCampo(campoAtual.slice(0, -1));
    }

    function limparCampo() {
        alterarCampo("");
    }

    async function consultarPedidoCancelamento() {
        if (!numeroPedido || Number(numeroPedido) <= 0) {
            setMensagem("Informe um número de pedido válido.");
            return;
        }

        setConsultandoPedido(true);
        setMensagem("");
        setPedidoEncontrado(null);

        try {
            const resposta = await fetch(
                "/api/pedidos/consultar-cancelamento",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        cpf,
                        numeroPedido: Number(numeroPedido),
                    }),
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok) {
                setMensagem(
                    dados.mensagem ||
                    "Pedido não encontrado ou indisponível para cancelamento."
                );
                return;
            }

            setPedidoEncontrado(dados.pedido);
            setEtapa("confirmacao");

        } catch {
            setMensagem(
                "Não foi possível consultar o pedido. Tente novamente."
            );
        } finally {
            setConsultandoPedido(false);
        }
    }

    function continuar() {
        setMensagem("");

        if (etapa === "cpf") {
            if (cpf.length !== 11) {
                setMensagem("Informe os 11 números do CPF.");
                return;
            }

            setEtapa("pedido");
            return;
        }

        if (etapa === "pedido") {
            consultarPedidoCancelamento();
        }
    }

    function voltar() {
        if (cancelandoPedido) return;

        setMensagem("");

        if (etapa === "sucesso") {
            onFechar();
        } else if (etapa === "pedido") {
            setEtapa("cpf");
        } else if (etapa === "confirmacao") {
            setEtapa("pedido");
        } else {
            onFechar();
        }
    }

    async function confirmarCancelamento() {
        if (cancelandoPedido || !pedidoEncontrado) return;

        setCancelandoPedido(true);
        setMensagem("");

        try {
            const resposta = await fetch("/api/pedidos/cancelar", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    cpf,
                    numeroPedido: pedidoEncontrado.idPedido,
                }),
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                setMensagem(
                    dados.mensagem ||
                    "Não foi possível cancelar o pedido."
                );
                return;
            }

            setEtapa("sucesso");
            setMensagem("");

        } catch {
            setMensagem(
                "Não foi possível confirmar o cancelamento. Consulte o status do pedido antes de tentar novamente."
            );
        } finally {
            setCancelandoPedido(false);
        }
    }

    return (
        <div className="cancelamento-overlay">
            <div
                className="cancelamento-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-cancelamento"
            >
                <h2 id="titulo-cancelamento">Cancelar pedido</h2>

                {etapa === "cpf" && (
                    <>
                        <p>Informe o CPF utilizado para realizar o pedido.</p>

                        <input
                            type="text"
                            inputMode="none"
                            value={cpf}
                            onChange={(e) => alterarCampo(e.target.value)}
                            placeholder="Digite seu CPF"
                            maxLength={11}
                            autoComplete="off"
                        />
                    </>
                )}

                {etapa === "pedido" && (
                    <>
                        <p>Informe o número do pedido que deseja cancelar.</p>

                        <p className="cancelamento-ajuda">
                            O número do pedido está localizado logo abaixo
                            da senha no comprovante impresso.
                        </p>

                        <input
                            type="text"
                            inputMode="none"
                            value={numeroPedido}
                            onChange={(e) => alterarCampo(e.target.value)}
                            placeholder="Número do pedido"
                            maxLength={12}
                            autoComplete="off"
                            disabled={consultandoPedido}
                        />
                    </>
                )}

                {etapa === "confirmacao" && pedidoEncontrado && (
                    <div className="cancelamento-confirmacao">
                        <p>Confira os dados antes de cancelar:</p>

                        <strong>
                            Pedido #{pedidoEncontrado.idPedido}
                        </strong>

                        <p>
                            Senha:{" "}
                            <b>{String(pedidoEncontrado.senha).padStart(3, "0")}</b>
                        </p>

                        <p>
                            Total estimado:{" "}
                            <b>
                                {Number(pedidoEncontrado.valorTotal).toLocaleString(
                                    "pt-BR",
                                    {
                                        style: "currency",
                                        currency: "BRL",
                                    }
                                )}
                            </b>
                        </p>

                        <p className="cancelamento-aviso">
                            Deseja realmente cancelar este pedido?
                            Esta operação não poderá ser desfeita.
                        </p>
                    </div>
                )}

                {(etapa === "cpf" || etapa === "pedido") &&
                    !consultandoPedido && (
                        <TecladoNumerico
                            onNumero={adicionarNumero}
                            onApagar={apagarNumero}
                            onLimpar={limparCampo}
                            onConfirmar={continuar}
                        />
                    )}
                {consultandoPedido && (
                    <p className="cancelamento-consultando">
                        Consultando pedido, aguarde...
                    </p>
                )}

                {etapa === "sucesso" && (
                    <div className="cancelamento-sucesso" role="status">
                        <h3>Pedido cancelado com sucesso!</h3>

                        <p>
                            O pedido #{pedidoEncontrado?.idPedido} foi cancelado.
                        </p>

                        <p>
                            A equipe do açougue será informada sobre o cancelamento.
                        </p>
                    </div>
                )}

                {mensagem && (
                    <p className="cancelamento-mensagem" role="alert">
                        {mensagem}
                    </p>
                )}

                <div className="cancelamento-acoes">
                    <button
                        type="button"
                        className="cancelamento-voltar"
                        onClick={voltar}
                        disabled={cancelandoPedido}
                    >
                        {etapa === "cpf" || etapa === "sucesso"
                            ? "Fechar"
                            : "Voltar"}
                    </button>

                    {etapa === "confirmacao" && (
                        <button
                            type="button"
                            className="cancelamento-confirmar"
                            onClick={confirmarCancelamento}
                            disabled={cancelandoPedido}
                        >
                            {cancelandoPedido
                                ? "Cancelando..."
                                : "Confirmar cancelamento"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ModalCancelarPedido;
