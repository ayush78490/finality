# Oracle bridge (DIA → Vara market)

## Data path

1. Pulls latest quotations from the **DIA Data API** (e.g. `GET https://api.diadata.org/v1/quotation/{SYMBOL}`). See [API reference](https://www.diadata.org/docs/reference/apis/token-prices/api-endpoints) and the [Oracle Playground](https://www.diadata.org/app/oracle-playground/) for available symbols.
2. Normalizes `Price` + `Time` into integer `price`, `conf`, `expo` (-8), `publish_time` (unix seconds) compatible with on-chain `PushPrice`.
3. Submits **`Fin.PushPrice`** to your **market program** on Vara testnet/mainnet.

## Trust + ops

- Map DIA’s HTTP response to the same fields the market already stores; enforce **staleness** and **oracle authority** on-chain (`Fin.init` / `push_price`).
- Run `services/dia-relayer` under a process manager (systemd, Kubernetes, PM2).
- Monitor: API latency, failed extrinsics, price age histogram.

## References

- [DIA docs home](https://www.diadata.org/docs/home)
- [DIA REST — token prices](https://www.diadata.org/docs/reference/apis/token-prices/api-endpoints)
- [Oracle Playground](https://www.diadata.org/app/oracle-playground/)
