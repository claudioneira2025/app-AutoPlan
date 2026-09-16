const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      ok: false,
      message: 'JSON inválido. Revisa el cuerpo enviado por el cliente.'
    });
  }

  return res.status(500).json({
    ok: false,
    message: 'Error interno del servidor.'
  });
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/autoplan';
const client = new MongoClient(MONGODB_URI);

async function getDb() {
  if (!client.topology || !client.topology.isConnected?.()) {
    await client.connect();
  }
  return client.db();
}

app.get('/api/health', async (_req, res) => {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    res.json({ ok: true, db: db.databaseName });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'No se pudo conectar a MongoDB', error: error.message });
  }
});

app.get('/api/vehiculos', async (_req, res) => {
  try {
    const db = await getDb();
    const vehicles = await db.collection('vehiculos').find({}).sort({ patente: 1 }).toArray();
    res.json(vehicles.map(({ _id, ...rest }) => ({ ...rest, id: _id.toString() })));
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener vehículos', error: error.message });
  }
});

app.post('/api/vehiculos', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    const db = await getDb();
    const collection = db.collection('vehiculos');

    await collection.deleteMany({});

    if (payload.length) {
      await collection.insertMany(payload);
    }

    const vehicles = await collection.find({}).sort({ patente: 1 }).toArray();
    res.status(201).json({
      ok: true,
      data: vehicles.map(({ _id, ...rest }) => ({ ...rest, id: _id.toString() }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar vehículos', error: error.message });
  }
});

app.get('/api/talleres', async (_req, res) => {
  try {
    const db = await getDb();
    const talleres = await db.collection('talleres').find({}).sort({ nombre: 1 }).toArray();
    res.json(talleres.map(({ _id, ...rest }) => ({ ...rest, id: _id.toString() })));
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener talleres', error: error.message });
  }
});

app.post('/api/talleres', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    const db = await getDb();
    const collection = db.collection('talleres');

    await collection.deleteMany({});

    if (payload.length) {
      await collection.insertMany(payload);
    }

    const talleres = await collection.find({}).sort({ nombre: 1 }).toArray();
    res.status(201).json({
      ok: true,
      data: talleres.map(({ _id, ...rest }) => ({ ...rest, id: _id.toString() }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar talleres', error: error.message });
  }
});

app.delete('/api/vehiculos/:patente', async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection('vehiculos').deleteOne({ patente: req.params.patente });
    res.json({ ok: true, deleted: result.deletedCount > 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar vehículo', error: error.message });
  }
});

app.delete('/api/talleres/:nombre', async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection('talleres').deleteOne({ nombre: req.params.nombre });
    res.json({ ok: true, deleted: result.deletedCount > 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar taller', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Mongo API listening on http://localhost:${port}`);
});
