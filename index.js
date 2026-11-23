import express from 'express';
import { createApi } from './api.js';

const app = express();
app.use('/api', createApi().api);
app.use(express.static('dist'));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('SalesPulse listening on port ' + port));
