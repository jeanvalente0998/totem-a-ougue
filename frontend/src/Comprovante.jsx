
import "./Comprovante.css";

function Comprovante({ pedido }) {
    if (!pedido) return null;

    const formatarMoeda = (valor) =>
        Number(valor).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });

    const formatarQuantidade = (quantidade, unidade) =>
        `${Number(quantidade).toLocaleString("pt-BR", {
            minimumFractionDigits: unidade === "KG" ? 3 : 0,
            maximumFractionDigits: 3,
        })} ${unidade}`;

    const formatarCorte = (corte) => {
        if (!corte) return null;

        return corte
            .replaceAll("_", " ")
            .toLowerCase()
            .replace(/(^|\s)\S/g, (letra) => letra.toUpperCase());
    };

    return (
        <section className="comprovante-impressao">
            <header className="comprovante-cabecalho">
                <h2>ATACADO COMPREMIX</h2>
                <p>AÇOUGUE - COMPROVANTE DE PEDIDO</p>
            </header>

            <div className="comprovante-linha" />

            <div className="comprovante-senha">
                <p>SENHA DE RETIRADA</p>
                <strong>{pedido.senha}</strong>
            </div>

            <div className="comprovante-dados">
                <p>Pedido: {pedido.pedidoId}</p>
                <p>Data: {pedido.data}</p>
            </div>

            <div className="comprovante-linha" />

            <h3>PRODUTOS</h3>

            <div className="comprovante-itens">
                {pedido.itens.map((item, indice) => (

                    <div
                        className="comprovante-item"
                        key={`${item.codigo}-${indice}`}
                    >
                        <div className="comprovante-item-colunas">

                            {/* Coluna esquerda: produto e corte */}
                            <div className="comprovante-item-esquerda">
                                <strong>{item.descricao}</strong>

                                {item.tipoCorte && (
                                    <span>
                                        Corte: {formatarCorte(item.tipoCorte)}
                                    </span>
                                )}
                            </div>

                            {/* Coluna direita: quantidade e valor */}
                            <div className="comprovante-item-direita">
                                <span>
                                    {formatarQuantidade(
                                        item.quantidade,
                                        item.unidade
                                    )}
                                </span>

                                <strong>
                                    {formatarMoeda(item.subtotal)}
                                </strong>
                            </div>

                        </div>
                    </div>

                ))}
            </div>

            <div className="comprovante-linha" />

            <div className="comprovante-total">
                <span>TOTAL ESTIMADO</span>
                <strong>{formatarMoeda(pedido.valorTotal)}</strong>
            </div>

            <div className="comprovante-linha" />

            <footer className="comprovante-rodape">
                <p>Aguarde a preparação do seu pedido.</p>
                <p>O peso e o valor final podem variar.</p>
                <strong>Obrigado pela preferência!</strong>
            </footer>
        </section>
    );
}

export default Comprovante;
