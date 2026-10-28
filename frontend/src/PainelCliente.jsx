
import { useEffect, useState } from "react";
import logoCompreMix from "./assets/logo-compre-mix.png";
import "./PainelCliente.css";

function PainelCliente() {
    const [pedidos, setPedidos] = useState([]);
    const [erro, setErro] = useState("");

    useEffect(() => {
        let ativo = true;

        async function carregarPedidos() {
            try {
                const resposta = await fetch("/api/pedidos", {
                    cache: "no-store",
                });

                if (!resposta.ok) {
                    throw new Error("Erro ao consultar pedidos.");
                }

                const dados = await resposta.json();

                const lista = Array.isArray(dados)
                    ? dados
                    : dados.pedidos;

                if (!Array.isArray(lista)) {
                    throw new Error("Formato de resposta inválido.");
                }

                // A API retorna uma linha por item.
                // Mantemos apenas um registro por pedido.
                const pedidosUnicos = new Map();

                lista.forEach((registro) => {
                    if (!pedidosUnicos.has(registro.ID_PEDIDO)) {
                        pedidosUnicos.set(registro.ID_PEDIDO, {
                            ID_PEDIDO: registro.ID_PEDIDO,
                            SENHA: registro.SENHA,
                            STATUS: registro.STATUS,
                            DATA_PEDIDO: registro.DATA_PEDIDO,
                        });
                    }
                });

                if (ativo) {
                    setPedidos(Array.from(pedidosUnicos.values()));
                    setErro("");
                }
            } catch (error) {
                console.error("Erro no painel do cliente:", error);

                if (ativo) {
                    setErro("Não foi possível atualizar os pedidos.");
                }
            }
        }

        carregarPedidos();

        const intervalo = setInterval(carregarPedidos, 2000);

        return () => {
            ativo = false;
            clearInterval(intervalo);
        };
    }, []);

    const colunas = [
        {
            id: "aguardando",
            titulo: "Aguardando preparação",
            status: "AGUARDANDO_PREPARACAO",
        },
        {
            id: "preparacao",
            titulo: "Em preparação",
            status: "EM_PREPARACAO",
        },
        {
            id: "prontos",
            titulo: "Pronto para retirada",
            status: "PRONTO_RETIRADA",
        },
    ];

    return (
        <main className="pagina-painel-cliente">

            <header className="painel-cliente-cabecalho">
                <div className="painel-cliente-cabecalho-texto">
                    <h1>Acompanhe seu Pedido</h1>
                </div>

                <div className="painel-cliente-marca">
                    <img
                        src={logoCompreMix}
                        alt="Atacado CompreMix"
                        className="painel-cliente-logo"
                    />
                </div>
            </header>

            {erro && (
                <p className="painel-cliente-erro" role="alert">
                    {erro}
                </p>
            )}

            <div className="painel-cliente-kanban">
                {colunas.map((coluna) => {
                    const pedidosColuna = pedidos.filter(
                        (pedido) => pedido.STATUS === coluna.status
                    );

                    return (
                        <section
                            key={coluna.id}
                            className={`painel-cliente-coluna coluna-${coluna.id}`}
                        >
                            <div className="painel-cliente-coluna-cabecalho">
                                <h2>{coluna.titulo}</h2>

                                <span className="painel-cliente-contador">
                                    {pedidosColuna.length}
                                </span>
                            </div>

                            <div className="painel-cliente-lista">
                                {pedidosColuna.map((pedido) => (
                                    <article
                                        key={pedido.ID_PEDIDO}
                                        className="painel-cliente-card"
                                    >

                                        <div className="painel-cliente-card-info">
                                            <span className="painel-cliente-label">
                                                SENHA
                                            </span>

                                            <strong className="painel-cliente-senha">
                                                {String(pedido.SENHA).padStart(3, "0")}
                                            </strong>
                                        </div>

                                    </article>
                                ))}

                                {pedidosColuna.length === 0 && (
                                    <p className="painel-cliente-vazio">
                                        Nenhum pedido nesta etapa.
                                    </p>
                                )}
                            </div>
                        </section>
                    );
                })}
            </div>
        </main>
    );
}

export default PainelCliente;
