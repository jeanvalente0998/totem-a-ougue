
import { useEffect, useState } from "react";
import "./Gerenciamento.css";

function Gerenciamento() {
    // Armazena os pedidos recebidos da API
    const [pedidos, setPedidos] = useState([]);

    // Controla o carregamento da consulta
    const [carregando, setCarregando] = useState(true);

    // Armazena possíveis erros
    const [erro, setErro] = useState("");

    useEffect(() => {
        async function carregarPedidos() {
            try {
                setCarregando(true);
                setErro("");

                // Consulta o backend utilizando o proxy do Vite
                const resposta = await fetch("/api/pedidos");

                if (!resposta.ok) {
                    throw new Error("Erro ao consultar os pedidos.");
                }

                const dados = await resposta.json();

                console.log("Pedidos recebidos:", dados);

                // Aceita tanto um array direto quanto { pedidos: [...] }
                const lista = Array.isArray(dados)
                    ? dados
                    : dados.pedidos;

                if (!Array.isArray(lista)) {
                    throw new Error("Formato de resposta inesperado.");
                }


                // Agrupa os itens pelo identificador do pedido
                const pedidosAgrupados = Object.values(
                    lista.reduce((acumulador, registro) => {
                        const id = registro.ID_PEDIDO;

                        // Cria o pedido caso ainda não exista
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

                        // Adiciona o produto ao pedido
                        if (registro.ID_ITEM != null) {
                            acumulador[id].itens.push({
                                ID_ITEM: registro.ID_ITEM,
                                CODPROD: registro.CODPROD,
                                DESCRICAO_PRODUTO: registro.DESCRICAO_PRODUTO,
                                QUANTIDADE: registro.QUANTIDADE,
                                UNIDADE_MEDIDA: registro.UNIDADE_MEDIDA,
                                PRECO_UNITARIO: registro.PRECO_UNITARIO,
                                SUBTOTAL: registro.SUBTOTAL,
                            });
                        }

                        return acumulador;
                    }, {})
                );

                // Atualiza o estado com os pedidos agrupados
                setPedidos(pedidosAgrupados);

                console.log("Pedidos agrupados:", pedidosAgrupados);

            } catch (error) {
                console.error("Erro ao carregar pedidos:", error);

                setErro(
                    "Não foi possível carregar os pedidos."
                );
            } finally {
                setCarregando(false);
            }
        }

        carregarPedidos();
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
                    <div className="lista-pedidos">

                        <p>
                            Total de pedidos encontrados: {pedidos.length}
                        </p>

                        {pedidos.map((pedido, index) => (
                            <div
                                key={pedido.NUMPEDIDO ?? pedido.ID ?? index}
                                className="card-pedido"
                            >
                                <pre>
                                    {JSON.stringify(pedido, null, 2)}
                                </pre>
                            </div>
                        ))}

                    </div>
                )}

            </section>

        </main>
    );
}

export default Gerenciamento;
