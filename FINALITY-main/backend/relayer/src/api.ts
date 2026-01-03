import express from 'express';
import cors from 'cors';

export class RelayerAPI {
    private app: express.Application;
    private port: number;
    private marketStates: Map<string, any> = new Map();

    constructor(port: number = 3001) {
        this.app = express();
        this.port = port;

        // Middleware
        this.app.use(cors());
        this.app.use(express.json());

        // Routes
        this.setupRoutes();
    }

    private setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Get market state
        this.app.get('/api/markets/:marketId/state', (req, res) => {
            const { marketId } = req.params;
            const state = this.marketStates.get(marketId);

            if (!state) {
                return res.status(404).json({ error: 'Market not found' });
            }

            res.json(state);
        });

        // Get all market states
        this.app.get('/api/markets/states', (req, res) => {
            const states = Array.from(this.marketStates.entries()).map(([id, state]) => ({
                marketId: id,
                ...state
            }));
            res.json(states);
        });
    }

    updateMarketState(marketId: string, state: any) {
        this.marketStates.set(marketId, {
            ...state,
            lastUpdated: new Date().toISOString()
        });
        console.log(`Updated market ${marketId} state in API`);
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`Relayer API listening on http://localhost:${this.port}`);
        });
    }

    stop() {
        // Express doesn't have a built-in stop method, but we can track the server
        console.log('Relayer API stopped');
    }
}
