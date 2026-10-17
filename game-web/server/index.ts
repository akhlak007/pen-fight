import { createRoomServer } from './room-server';

const port = Number(process.env.PORT ?? (process.argv.includes('--production') ? 4173 : 4174));
const app = createRoomServer({ port, allowCrossPortOrigin: !process.argv.includes('--production') });
app.listen().then((actualPort) => console.log(`Pen Fight room server ready on http://0.0.0.0:${actualPort}`));
