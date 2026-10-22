
import { useEffect, useRef, useState } from "react";
import "./Gerenciamento.css";

function Gerenciamento() {
    // Armazena os pedidos recebidos da API
    const [pedidos, setPedidos] = useState([]);

    // Controla o carregamento da consulta
    const [carregando, setCarregando] = useState(true);

    // Armazena possíveis erros
    const [erro, setErro] = useState("");

    const [pedidoAtualizando, setPedidoAtualizando] = useState(null);


    const [novosPedidos, setNovosPedidos] = useState([]);
    const [notificacaoNovoPedido, setNotificacaoNovoPedido] = useState(null);

    // Guarda os IDs dos pedidos já conhecidos.
    const idsPedidosConhecidos = useRef(new Set());

    // Indica se já realizamos a primeira consulta.
    const primeiraConsultaConcluida = useRef(false);


    // Organiza os pedidos conforme a etapa de preparação.
    const pedidosAguardando = pedidos.filter(
        (pedido) => pedido.STATUS === "AGUARDANDO_SEPARACAO"
    );

    const pedidosEmPreparacao = pedidos.filter(
        (pedido) => pedido.STATUS === "EM_PREPARACAO"
    );

    const pedidosProntos = pedidos.filter(
        (pedido) => pedido.STATUS === "PRONTO_RETIRADA"
    );


    const colunasKanban = [
        {
            id: "aguardando",
            titulo: "Aguardando separação",
            pedidos: pedidosAguardando,
        },
        {
            id: "preparacao",
            titulo: "Em preparação",
            pedidos: pedidosEmPreparacao,
        },
        {
            id: "prontos",
            titulo: "Pronto para retirada",
            pedidos: pedidosProntos,
        },
    ];


    // Envia a atualização do pedido para o backend.
    async function alterarStatusPedido(idPedido, novoStatus) {
        if (pedidoAtualizando !== null) return;

        try {
            setPedidoAtualizando(idPedido);
            setErro("");

            const resposta = await fetch(
                `/api/pedidos/${idPedido}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        status: novoStatus,
                    }),
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok) {
                throw new Error(
                    dados.mensagem || "Erro ao atualizar o pedido."
                );
            }

            // Atualiza somente o pedido alterado na interface.
            setPedidos((pedidosAnteriores) =>
                pedidosAnteriores.map((pedido) =>
                    pedido.ID_PEDIDO === idPedido
                        ? { ...pedido, STATUS: novoStatus }
                        : pedido
                )
            );

        } catch (error) {
            console.error("Erro ao alterar status:", error);
            setErro(error.message);
        } finally {
            setPedidoAtualizando(null);
        }
    }



    useEffect(() => {
        let ativo = true;
        let consultando = false;

        async function carregarPedidos(primeiraConsulta = false) {
            // Impede consultas simultâneas.
            if (consultando || !ativo) return;

            consultando = true;

            try {
                // Exibe carregamento apenas na primeira consulta.
                if (primeiraConsulta) {
                    setCarregando(true);
                }

                // Consulta o backend utilizando o proxy do Vite.
                const resposta = await fetch("/api/pedidos", {
                    cache: "no-store",
                });

                if (!resposta.ok) {
                    throw new Error("Erro ao consultar os pedidos.");
                }

                const dados = await resposta.json();

                // Aceita um array direto ou { pedidos: [...] }.
                const lista = Array.isArray(dados)
                    ? dados
                    : dados.pedidos;

                if (!Array.isArray(lista)) {
                    throw new Error("Formato de resposta inesperado.");
                }

                // Agrupa os itens pelo identificador do pedido.
                const pedidosAgrupados = Object.values(
                    lista.reduce((acumulador, registro) => {
                        const id = registro.ID_PEDIDO;

                        // Cria o pedido caso ainda não exista.
                        if (!acumulador[id]) {
                            acumulador[id] = {
                                ID_PEDIDO: registro.ID_PEDIDO,
                                SENHA: registro.SENHA,
                                CODCLI: registro.CODCLI,
                                DATA_PEDIDO: registro.DATA_PEDIDO,
                                STATUS: registro.STATUS,
                                VALOR_TOTAL: registro.VALOR_TOTAL,
                                itens: [],
                            };
                        }

                        // Adiciona os produtos ao pedido.
                        if (registro.ID_ITEM != null) {
                            acumulador[id].itens.push({
                                ID_ITEM: registro.ID_ITEM,
                                CODPROD: registro.CODPROD,
                                DESCRICAO_PRODUTO: registro.DESCRICAO_PRODUTO,
                                QUANTIDADE: registro.QUANTIDADE,
                                UNIDADE_MEDIDA: registro.UNIDADE_MEDIDA,
                                PRECO_UNITARIO: registro.PRECO_UNITARIO,
                                SUBTOTAL: registro.SUBTOTAL,
                                TIPO_CORTE: registro.TIPO_CORTE,
                            });
                        }

                        return acumulador;
                    }, {})
                );

                // Não atualiza o estado após desmontar o componente.
                if (!ativo) return;


                // Na primeira consulta, apenas registra os pedidos existentes.
                if (!primeiraConsultaConcluida.current) {

                    idsPedidosConhecidos.current = new Set(
                        pedidosAgrupados.map((pedido) => pedido.ID_PEDIDO)
                    );

                    primeiraConsultaConcluida.current = true;

                } else {

                    // Identifica pedidos que ainda não haviam sido recebidos.
                    const pedidosNovos = pedidosAgrupados.filter(
                        (pedido) =>
                            !idsPedidosConhecidos.current.has(pedido.ID_PEDIDO)
                    );

                    if (pedidosNovos.length > 0) {

                        // Guarda os IDs para destacar os cards.
                        setNovosPedidos(
                            pedidosNovos.map((pedido) => pedido.ID_PEDIDO)
                        );

                        // Guarda a informação para o aviso visual.
                        setNotificacaoNovoPedido({
                            quantidade: pedidosNovos.length,
                            senhas: pedidosNovos.map((pedido) =>
                                String(pedido.SENHA).padStart(3, "0")
                            ),
                        });

                        console.log("Novos pedidos detectados:", pedidosNovos);
                    }

                    // Atualiza a lista de IDs conhecidos.
                    pedidosAgrupados.forEach((pedido) => {
                        idsPedidosConhecidos.current.add(pedido.ID_PEDIDO);
                    });
                }

                // Atualiza normalmente os pedidos do Kanban.
                setPedidos(pedidosAgrupados);

                // Limpa mensagens de erro após uma consulta bem-sucedida.
                setErro("");

            } catch (error) {
                console.error("Erro ao carregar pedidos:", error);

                if (ativo) {
                    // Na atualização automática, mantém os pedidos
                    // anteriores visíveis se houver falha de conexão.
                    if (primeiraConsulta) {
                        setErro("Não foi possível carregar os pedidos.");
                    }
                }

            } finally {
                consultando = false;

                if (ativo && primeiraConsulta) {
                    setCarregando(false);
                }
            }
        }

        // Primeira consulta ao abrir o gerenciamento.
        carregarPedidos(true);

        // Consulta novamente a cada 5 segundos.
        const intervalo = setInterval(() => {
            carregarPedidos(false);
        }, 5000);

        // Remove o intervalo quando o componente é desmontado.
        return () => {
            ativo = false;
            clearInterval(intervalo);
        };

    }, []);

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

                {/* Aviso visual de novos pedidos */}
                {notificacaoNovoPedido && (
                    <div className="alerta-novo-pedido">

                        <div>
                            <strong>🔔 Novo pedido recebido!</strong>

                            <p>
                                {notificacaoNovoPedido.quantidade === 1
                                    ? "Um novo pedido chegou do totem."
                                    : `${notificacaoNovoPedido.quantidade} novos pedidos chegaram do totem.`}
                            </p>

                            <p>
                                Senha(s): {notificacaoNovoPedido.senhas.join(", ")}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setNotificacaoNovoPedido(null)}
                        >
                            Fechar
                        </button>

                    </div>
                )}

                {carregando && (
                    <p className="mensagem-vazia">
                        Carregando pedidos...
                    </p>
                )}

                {erro && (
                    <p className="mensagem-vazia">
                        {erro}
                    </p>
                )}

                {!carregando && !erro && pedidos.length === 0 && (
                    <p className="mensagem-vazia">
                        Nenhum pedido encontrado.
                    </p>
                )}


                {!carregando && !erro && pedidos.length > 0 && (
                    <div className="quadro-kanban">

                        {colunasKanban.map((coluna) => (
                            <section
                                key={coluna.id}
                                className={`coluna-kanban coluna-${coluna.id}`}
                            >

                                {/* Cabeçalho da coluna */}
                                <div className="coluna-kanban-cabecalho">
                                    <h2>{coluna.titulo}</h2>

                                    <span className="coluna-kanban-contador">
                                        {coluna.pedidos.length}
                                    </span>
                                </div>

                                {/* Pedidos da coluna */}
                                <div className="coluna-kanban-pedidos">

                                    {coluna.pedidos.map((pedido) => (
                                        <div
                                            key={pedido.ID_PEDIDO}
                                            className="card-pedido"
                                        >

                                            {/* Cabeçalho do pedido */}
                                            <div className="card-pedido-cabecalho">
                                                <div>
                                                    <span className="card-pedido-label-senha">
                                                        SENHA
                                                    </span>

                                                    <h3>
                                                        {String(pedido.SENHA).padStart(3, "0")}
                                                    </h3>

                                                    <p>Pedido #{pedido.ID_PEDIDO}</p>
                                                </div>

                                                <span
                                                    className={`card-pedido-status ${pedido.STATUS === "AGUARDANDO_SEPARACAO"
                                                        ? "status-aguardando"
                                                        : pedido.STATUS === "EM_PREPARACAO"
                                                            ? "status-preparacao"
                                                            : pedido.STATUS === "PRONTO_RETIRADA"
                                                                ? "status-pronto"
                                                                : ""
                                                        }`}
                                                >
                                                    {pedido.STATUS?.replaceAll("_", " ")}
                                                </span>
                                            </div>

                                            {/* Produtos do pedido */}
                                            <div className="card-pedido-itens">
                                                {pedido.itens.map((item) => (
                                                    <div
                                                        key={item.ID_ITEM}
                                                        className="card-pedido-item"
                                                    >
                                                        <strong>
                                                            {item.DESCRICAO_PRODUTO}
                                                        </strong>

                                                        <p>
                                                            Quantidade: {Number(item.QUANTIDADE)
                                                                .toLocaleString("pt-BR", {
                                                                    minimumFractionDigits: 3,
                                                                    maximumFractionDigits: 3
                                                                })} {item.UNIDADE_MEDIDA}
                                                        </p>

                                                        {item.TIPO_CORTE && (
                                                            <p className="card-pedido-corte">
                                                                Tipo de corte:{" "}
                                                                <strong>
                                                                    {item.TIPO_CORTE.replaceAll("_", " ")}
                                                                </strong>
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Rodapé do pedido */}
                                            <div className="card-pedido-rodape">
                                                <span>Valor total</span>

                                                <strong>
                                                    {Number(pedido.VALOR_TOTAL)
                                                        .toLocaleString("pt-BR", {
                                                            style: "currency",
                                                            currency: "BRL"
                                                        })}
                                                </strong>
                                            </div>


                                            {/* Ações de preparação do pedido */}
                                            <div className="card-pedido-acoes">

                                                {/* Pedido aguardando: permite iniciar */}
                                                {pedido.STATUS === "AGUARDANDO_SEPARACAO" && (
                                                    <button
                                                        type="button"
                                                        className="botao-iniciar-preparacao"
                                                        disabled={pedidoAtualizando !== null}
                                                        onClick={() =>
                                                            alterarStatusPedido(
                                                                pedido.ID_PEDIDO,
                                                                "EM_PREPARACAO"
                                                            )
                                                        }
                                                    >
                                                        {pedidoAtualizando === pedido.ID_PEDIDO
                                                            ? "Atualizando..."
                                                            : "Iniciar preparação"}
                                                    </button>
                                                )}

                                                {/* Pedido em preparação: permite finalizar */}
                                                {pedido.STATUS === "EM_PREPARACAO" && (
                                                    <button
                                                        type="button"
                                                        className="botao-finalizar-preparacao"
                                                        disabled={pedidoAtualizando !== null}
                                                        onClick={() =>
                                                            alterarStatusPedido(
                                                                pedido.ID_PEDIDO,
                                                                "PRONTO_RETIRADA"
                                                            )
                                                        }
                                                    >
                                                        {pedidoAtualizando === pedido.ID_PEDIDO
                                                            ? "Atualizando..."
                                                            : "Finalizar preparação"}
                                                    </button>
                                                )}

                                                {/* Pedido pronto: exibe confirmação */}
                                                {pedido.STATUS === "PRONTO_RETIRADA" && (
                                                    <div className="pedido-finalizado">
                                                        Pronto para retirada
                                                    </div>
                                                )}

                                            </div>

                                        </div>
                                    ))}

                                    {/* Mensagem quando a coluna estiver vazia */}
                                    {coluna.pedidos.length === 0 && (
                                        <p className="coluna-kanban-vazia">
                                            Nenhum pedido nesta etapa.
                                        </p>
                                    )}

                                </div>

                            </section>
                        ))}

                    </div>
                )}

            </section>

        </main>
    );
}

export default Gerenciamento;
