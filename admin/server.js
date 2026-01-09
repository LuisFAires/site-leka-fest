const express = require('express');
const fs = require('fs');
const path = require('path');
const livereload = require('livereload');
const connectLiveReload = require('connect-livereload');
const multer = require('multer');
const app = express();
const PORT = 3000;

// Caminho do arquivo JSON  
const DATA_FILE = path.join(__dirname, 'acervo.json');
const ACERVO_DIR = path.join(__dirname, 'acervo');

// Configurar multer para upload de imagens
const upload = multer({ dest: ACERVO_DIR });

// Configurar livereload
const liveReloadServer = livereload.createServer();
liveReloadServer.watch(path.join(__dirname, '.'));
app.use(connectLiveReload());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// Util: ler JSON
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

// Util: sobrescrever JSON
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Util: deletar pasta se estiver vazia
function deleteEmptyDir(dirPath) {
  try {
    if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
      fs.rmdirSync(dirPath);
      return true;
    }
  } catch (e) {
    console.error('Erro ao deletar pasta:', e.message);
  }
  return false;
}

// GET: Listar todos os itens
app.get('/api/items', (req, res) => {
  res.json(readData());
});

// POST: Criar novo item
app.post('/api/items', (req, res) => {
  const { title, description = '', categorias = [], images = [] } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Título é obrigatório' });
  }

  const data = readData();

  // Evitar duplicados por título
  if (data.some(item => item.title.toLowerCase() === title.toLowerCase())) {
    return res.status(409).json({ error: 'Já existe um item com esse título' });
  }

  data.unshift({ title, description, categorias, images });
  writeData(data);
  res.status(201).json({ title, description, categorias, images });
});

// PUT: Atualizar item por título
app.put('/api/items/:title', (req, res) => {
  const { title, description, categorias, images } = req.body;
  const data = readData();
  const index = data.findIndex(item => item.title.toLowerCase() === req.params.title.toLowerCase());

  if (index === -1) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  const updated = {
    title: title ?? data[index].title,
    description: description ?? data[index].description,
    categorias: Array.isArray(categorias) ? categorias : data[index].categorias,
    images: Array.isArray(images) ? images : data[index].images,
  };

  // Se mudou o título, evitar conflito
  if (
    updated.title.toLowerCase() !== data[index].title.toLowerCase() &&
    data.some((it, i) => i !== index && it.title.toLowerCase() === updated.title.toLowerCase())
  ) {
    return res.status(409).json({ error: 'Já existe outro item com esse título' });
  }

  data[index] = updated;
  writeData(data);
  res.json(updated);
});

// DELETE: Excluir item por título
app.delete('/api/items/:title', (req, res) => {
  const data = readData();
  const index = data.findIndex(item => item.title.toLowerCase() === req.params.title.toLowerCase());

  if (index === -1) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  const removed = data.splice(index, 1)[0];
  writeData(data);
  res.json(removed);
});

// POST: Upload de imagens
app.post('/api/upload/:title', upload.array('files'), (req, res) => {
  const { title } = req.params;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
  }

  const dirName = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const dirPath = path.join(ACERVO_DIR, dirName);

  // Criar diretório se não existir
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const uploadedFiles = [];
  files.forEach(file => {
    try {
      const finalPath = path.join(dirPath, file.originalname);
      fs.renameSync(file.path, finalPath);
      uploadedFiles.push(`${dirName}/${file.originalname}`);
    } catch (e) {
      fs.unlinkSync(file.path);
    }
  });

  res.json({ success: true, images: uploadedFiles });
});

// DELETE: Excluir imagem
app.delete('/api/image', (req, res) => {
  const { imagePath } = req.body;

  if (!imagePath) {
    return res.status(400).json({ error: 'imagePath é obrigatório' });
  }

  const fullPath = path.join(ACERVO_DIR, imagePath);

  // Evitar path traversal
  if (!fullPath.startsWith(ACERVO_DIR)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      deleteEmptyDir(path.dirname(fullPath));
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Arquivo não encontrado' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Erro ao deletar arquivo' });
  }
});

// PUT: Reordenar itens (drag and drop)
app.put('/api/items', (req, res) => {
  const body = req.body;
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'Deve ser um array de itens' });
  }

  const isValid = body.every(it =>
    it && typeof it.title === 'string' && typeof it.description === 'string' &&
    Array.isArray(it.categorias) && Array.isArray(it.images)
  );

  if (!isValid) {
    return res.status(400).json({ error: 'Estrutura inválida' });
  }

  writeData(body);
  res.json({ message: 'Itens atualizados', count: body.length });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});