
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

    const [somHabilitado, setSomHabilitado] = useState(false);

    const contextoAudio = useRef(null);
    const somHabilitadoRef = useRef(false);

    const [codigoLido, setCodigoLido] = useState("");
    const [resultadoLeitura, setResultadoLeitura] = useState(null);

    const bufferScanner = useRef("");
    const ultimoCaractereScanner = useRef(0);

    const identificarPedidoRef = useRef(null);
    identificarPedidoRef.current = identificarPedido;

    const [ultimoPedidoLido, setUltimoPedidoLido] = useState(null);

    // Atualiza o tempo usado para identificar pedidos novos.
    const [agora, setAgora] = useState(() => Date.now());

    useEffect(() => {
        const intervalo = setInterval(() => {
            setAgora(Date.now());
        }, 5000);

        return () => clearInterval(intervalo);
    }, []);


    // Organiza os pedidos conforme a etapa de preparação.
    const pedidosAguardando = pedidos.filter(
        (pedido) => pedido.STATUS === "AGUARDANDO_PREPARACAO"
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
            titulo: "Aguardando preparação",
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

    const TEMPO_PEDIDO_NOVO = 5 * 60 * 1000;

    // Verifica se o pedido ainda deve receber o destaque NOVO.
    function pedidoEhNovo(pedido, agora) {
        // Somente pedidos aguardando preparação podem ser novos.
        if (pedido.STATUS !== "AGUARDANDO_PREPARACAO") {
            return false;
        }

        const dataPedido = new Date(pedido.DATA_PEDIDO).getTime();

        // Não destaca pedidos com data inválida.
        if (!Number.isFinite(dataPedido)) {
            return false;
        }

        const tempoDecorrido = agora - dataPedido;

        return (
            tempoDecorrido >= 0 &&
            tempoDecorrido < TEMPO_PEDIDO_NOVO
        );
    }

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

            // Remove o destaque após a atualização bem-sucedida.
            setNovosPedidos((anteriores) =>
                anteriores.filter((id) => id !== idPedido)
            );

        } catch (error) {
            console.error("Erro ao alterar status:", error);
            setErro(error.message);
        } finally {
            setPedidoAtualizando(null);
        }
    }


    function tocarAlerta() {
        if (!somHabilitadoRef.current) return;

        const audio = contextoAudio.current;

        if (!audio || audio.state !== "running") return;

        try {
            // Reproduz dois sinais sonoros curtos.
            [0, 0.3].forEach((atraso) => {
                const oscilador = audio.createOscillator();
                const volume = audio.createGain();

                oscilador.type = "sine";
                oscilador.frequency.value = 880;

                volume.gain.setValueAtTime(
                    0.0001,
                    audio.currentTime + atraso
                );

                volume.gain.exponentialRampToValueAtTime(
                    0.18,
                    audio.currentTime + atraso + 0.02
                );

                volume.gain.exponentialRampToValueAtTime(
                    0.0001,
                    audio.currentTime + atraso + 0.2
                );

                oscilador.connect(volume);
                volume.connect(audio.destination);

                oscilador.start(audio.currentTime + atraso);
                oscilador.stop(audio.currentTime + atraso + 0.21);
            });
        } catch (error) {
            console.error("Erro ao reproduzir alerta:", error);
        }
    }


    async function alternarSom() {
        // Se estiver habilitado, desativa o alerta.
        if (somHabilitadoRef.current) {
            somHabilitadoRef.current = false;
            setSomHabilitado(false);
            return;
        }

        // Se estiver desabilitado, habilita novamente.
        try {
            const AudioContext =
                window.AudioContext || window.webkitAudioContext;

            if (!AudioContext) {
                throw new Error("Navegador sem suporte a áudio.");
            }

            if (!contextoAudio.current) {
                contextoAudio.current = new AudioContext();
            }

            await contextoAudio.current.resume();

            if (contextoAudio.current.state !== "running") {
                throw new Error("O áudio não foi liberado.");
            }

            somHabilitadoRef.current = true;
            setSomHabilitado(true);

            // Reproduz um sinal para confirmar a ativação.
            tocarAlerta();

        } catch (error) {
            console.error("Erro ao alternar o som:", error);
            alert("Não foi possível habilitar o áudio.");
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

                        // Reproduz o alerta quando novos pedidos são detectados.
                        tocarAlerta();
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


    async function identificarPedido(codigoRecebido) {
        const codigo = codigoRecebido.trim().toUpperCase();

        const correspondencia = /^PED-([1-9]\d*)$/.exec(codigo);

        if (!correspondencia) {
            setResultadoLeitura({
                sucesso: false,
                mensagem: "Código de barras inválido.",
            });
            setCodigoLido("");
            return;
        }

        const idPedido = Number(correspondencia[1]);

        if (!Number.isSafeInteger(idPedido)) {
            setResultadoLeitura({
                sucesso: false,
                mensagem: "Identificador do pedido inválido.",
            });
            setCodigoLido("");
            return;
        }

        try {
            setResultadoLeitura({
                sucesso: true,
                mensagem: `Processando pedido #${idPedido}...`,
            });

            const resposta = await fetch("/api/pedidos/scan", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ codigo }),
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                setResultadoLeitura({
                    sucesso: false,
                    mensagem: dados.mensagem || "Erro ao processar pedido.",
                });
                return;
            }

            const pedidoEncontrado = pedidos.find(
                (pedido) => Number(pedido.ID_PEDIDO) === idPedido
            );

            setUltimoPedidoLido({
                idPedido,
                senha: pedidoEncontrado?.SENHA ?? null,
                status: dados.status,
            });

            setResultadoLeitura({
                sucesso: true,
                mensagem: `Pedido #${idPedido} atualizado: ${dados.statusAnterior} → ${dados.status}`,
            });

            console.log("Pedido atualizado pelo scanner:", dados);

            // O polling existente atualizará o Kanban automaticamente.

        } catch (erro) {
            console.error("Erro na leitura do scanner:", erro);

            setResultadoLeitura({
                sucesso: false,
                mensagem: "Não foi possível comunicar com o servidor.",
            });

        } finally {
            setCodigoLido("");
        }
    }

    function processarCodigoBarras(evento) {
        evento.preventDefault();
        identificarPedido(codigoLido);
    }

    useEffect(() => {
        function capturarScanner(evento) {
            // Não interfere em campos de digitação manual.
            const elemento = evento.target;

            if (
                elemento instanceof HTMLElement &&
                (
                    elemento.isContentEditable ||
                    ["INPUT", "TEXTAREA", "SELECT"].includes(elemento.tagName)
                )
            ) {
                return;
            }

            const agora = Date.now();

            // Reinicia o buffer se houver pausa entre caracteres.
            if (agora - ultimoCaractereScanner.current > 150) {
                bufferScanner.current = "";
            }

            ultimoCaractereScanner.current = agora;

            // Finaliza a leitura quando o scanner envia Enter.
            if (evento.key === "Enter") {
                const codigo = bufferScanner.current.trim().toUpperCase();

                bufferScanner.current = "";

                if (/^PED-[1-9]\d*$/.test(codigo)) {
                    evento.preventDefault();

                    // Envia o código para o campo de leitura.
                    identificarPedidoRef.current?.(codigo);
                }

                return;
            }

            // Armazena os caracteres enviados pelo scanner.
            if (
                evento.key.length === 1 &&
                !evento.ctrlKey &&
                !evento.altKey &&
                !evento.metaKey
            ) {
                bufferScanner.current += evento.key;
            }
        }

        window.addEventListener("keydown", capturarScanner);

        return () => {
            window.removeEventListener("keydown", capturarScanner);
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


                {/* Leitura de códigos de barras */}
                <div className="leitor-pedidos">

                    <div className="leitor-pedidos-cabecalho">
                        <div>
                            <p>
                                Escaneie o código de barras do comprovante
                                para identificar o pedido.
                            </p>
                        </div>
                    </div>


                    {ultimoPedidoLido && resultadoLeitura?.sucesso ? (
                        <div
                            className={`leitor-pedido-identificado ${ultimoPedidoLido.status === "EM_PREPARACAO"
                                ? "painel-em-preparacao"
                                : ultimoPedidoLido.status === "PRONTO_RETIRADA"
                                    ? "painel-pronto-retirada"
                                    : ""
                                }`}
                            role="status"
                        >
                            <span className="leitor-senha-label">
                                SENHA DE RETIRADA
                            </span>

                            <strong className="leitor-senha-numero">
                                {ultimoPedidoLido.senha != null
                                    ? String(ultimoPedidoLido.senha).padStart(3, "0")
                                    : "—"}
                            </strong>

                            <span className="leitor-pedido-numero">
                                Pedido #{ultimoPedidoLido.idPedido}
                            </span>

                            <span className="leitor-pedido-status">
                                {ultimoPedidoLido.status === "EM_PREPARACAO"
                                    ? "Em preparação"
                                    : ultimoPedidoLido.status === "PRONTO_RETIRADA"
                                        ? "Pronto para retirada"
                                        : ultimoPedidoLido.status}
                            </span>
                        </div>
                    ) : resultadoLeitura ? (
                        <div
                            className={`leitor-pedidos-resultado ${resultadoLeitura.sucesso
                                ? "leitura-sucesso"
                                : "leitura-erro"
                                }`}
                            role="status"
                        >
                            {resultadoLeitura.mensagem}
                        </div>
                    ) : (
                        <div className="leitor-pedido-aguardando">
                        </div>
                    )}

                </div>

                {/* Controle de notificações sonoras */}
                <div className="controle-som">

                    <div className="controle-som-informacoes">
                        <strong>Notificações sonoras</strong>
                        <span>Alertas de novos pedidos</span>
                    </div>

                    <button
                        type="button"
                        className={`botao-controle-som ${somHabilitado ? "som-ativo" : "som-inativo"
                            }`}
                        onClick={alternarSom}
                        aria-pressed={somHabilitado}
                        aria-label={
                            somHabilitado
                                ? "Desativar notificações sonoras"
                                : "Ativar notificações sonoras"
                        }
                    >
                        <span className="controle-som-icone" aria-hidden="true">
                            {somHabilitado ? "♪" : "♪"}
                        </span>

                        <span className="controle-som-texto">
                            {somHabilitado ? "Ativado" : "Desativado"}
                        </span>

                        <span className="controle-som-switch" aria-hidden="true">
                            <span className="controle-som-switch-bola"></span>
                        </span>
                    </button>

                </div>


                {/* Notificação visual de novos pedidos */}
                {notificacaoNovoPedido && (
                    <div
                        className="alerta-novo-pedido"
                        role="status"
                        aria-live="polite"
                    >
                        {/* Ícone do alerta */}
                        <div className="alerta-pedido-icone">
                            <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                                <path d="M10 21h4" />
                            </svg>
                        </div>

                        {/* Informações do pedido */}
                        <div className="alerta-pedido-conteudo">

                            <div className="alerta-pedido-titulo">
                                <strong>
                                    {notificacaoNovoPedido.quantidade === 1
                                        ? "Novo pedido recebido"
                                        : "Novos pedidos recebidos"}
                                </strong>

                                <span className="alerta-pedido-badge">
                                    Novo
                                </span>
                            </div>

                            <div className="alerta-pedido-senhas">
                                <span>
                                    {notificacaoNovoPedido.quantidade === 1
                                        ? "Senha"
                                        : "Senhas"}
                                </span>

                                {notificacaoNovoPedido.senhas.map((senha, index) => (
                                    <strong
                                        key={`${senha}-${index}`}
                                        className="alerta-pedido-senha"
                                    >
                                        {senha}
                                    </strong>
                                ))}
                            </div>

                        </div>

                        {/* Botão para dispensar a notificação */}
                        <button
                            type="button"
                            className="alerta-pedido-fechar"
                            onClick={() => setNotificacaoNovoPedido(null)}
                            aria-label="Fechar notificação"
                            title="Fechar notificação"
                        >
                            ×
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
                                            className={`card-pedido ${pedidoEhNovo(pedido, agora)
                                                ? "card-pedido-novo"
                                                : ""
                                                }`}
                                        >
                                            {/* Cabeçalho do pedido */}
                                            <div className="card-pedido-cabecalho">

                                                {/* Identificação de pedido recém-chegado */}
                                                {pedidoEhNovo(pedido, agora) && (
                                                    <span className="card-pedido-etiqueta-novo">
                                                        NOVO
                                                    </span>
                                                )}
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
                                                    className={`card-pedido-status ${pedido.STATUS === "AGUARDANDO_PREPARACAO"
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
                                                {pedido.STATUS === "AGUARDANDO_PREPARACAO" && (
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
