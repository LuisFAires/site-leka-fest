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
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

// Util: escrever JSON (sobrescrever)
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Util: deletar pasta se estiver vazia
function deleteEmptyDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      if (files.length === 0) {
        fs.rmdirSync(dirPath);
        return true;
      }
    }
  } catch (e) {
    console.error('Erro ao deletar pasta:', e.message);
  }
  return false;
}

// Listar todos
app.get('/api/items', (req, res) => {
  const data = readData();
  res.json(data);
});

// Criar novo
app.post('/api/items', (req, res) => {
  const { title, description = '', categorias = [], images = [] } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title é obrigatório e deve ser string' });
  }

  const data = readData();

  // Evitar duplicados por título
  if (data.some(item => item.title.toLowerCase() === title.toLowerCase())) {
    return res.status(409).json({ error: 'Já existe um item com esse title' });
  }

  const newItem = { title, description, categorias, images };
  data.unshift(newItem);
  writeData(data);
  res.status(201).json(newItem);
});

// Atualizar por título (PUT)
app.put('/api/items/:title', (req, res) => {
  const paramTitle = req.params.title;
  const { title, description, categorias, images } = req.body;

  const data = readData();
  const index = data.findIndex(item => item.title.toLowerCase() === paramTitle.toLowerCase());
  if (index === -1) return res.status(404).json({ error: 'Item não encontrado' });

  // Atualiza mantendo estrutura
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
    return res.status(409).json({ error: 'Conflito: já existe item com o novo title' });
  }

  data[index] = updated;
  writeData(data);
  res.json(updated);
});

// Excluir por título
app.delete('/api/items/:title', (req, res) => {
  const paramTitle = req.params.title;
  const data = readData();
  const index = data.findIndex(item => item.title.toLowerCase() === paramTitle.toLowerCase());
  if (index === -1) return res.status(404).json({ error: 'Item não encontrado' });

  const removed = data.splice(index, 1)[0];
  writeData(data);
  res.json(removed);
});

// Upload de múltiplas imagens
app.post('/api/upload/:title', upload.array('files'), (req, res) => {
  const { title } = req.params;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
  }

  const formattedTitle = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const dirPath = path.join(ACERVO_DIR, formattedTitle);

  // Criar diretório se não existir
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const uploadedFiles = [];

  files.forEach(file => {
    const originalName = file.originalname;
    const finalPath = path.join(dirPath, originalName);
    
    try {
      fs.renameSync(file.path, finalPath);
      uploadedFiles.push(`${formattedTitle}/${originalName}`);
    } catch (e) {
      fs.unlinkSync(file.path);
    }
  });

  res.json({ success: true, images: uploadedFiles });
});

// Deletar uma imagem específica
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
      
      // Tentar deletar a pasta se estiver vazia
      const dirPath = path.dirname(fullPath);
      deleteEmptyDir(dirPath);
      
      res.json({ success: true, message: 'Imagem deletada' });
    } else {
      res.status(404).json({ error: 'Arquivo não encontrado' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Erro ao deletar arquivo' });
  }
});

// Sobrescrever arquivo inteiro (opcional)
app.put('/api/items', (req, res) => {
  const body = req.body;
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'O corpo deve ser um array de itens' });
  }
  // Validação simples
  const isValid = body.every(
    it =>
      it &&
      typeof it.title === 'string' &&
      typeof it.description === 'string' &&
      Array.isArray(it.categorias) &&
      Array.isArray(it.images)
  );
  if (!isValid) return res.status(400).json({ error: 'Estrutura inválida em algum item' });

  writeData(body);
  res.json({ message: 'Arquivo sobrescrito com sucesso', count: body.length });
});

// Reordenar item (mover para cima ou para baixo)
app.post('/api/reorder', (req, res) => {
  const { title, direction } = req.body;
  
  if (!title || !direction || !['up', 'down'].includes(direction)) {
    return res.status(400).json({ error: 'title e direction (up/down) são obrigatórios' });
  }

  const data = readData();
  const index = data.findIndex(item => item.title.toLowerCase() === title.toLowerCase());
  
  if (index === -1) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  if (direction === 'up' && index === 0) {
    return res.status(400).json({ error: 'Item já está no topo' });
  }

  if (direction === 'down' && index === data.length - 1) {
    return res.status(400).json({ error: 'Item já está no final' });
  }

  // Trocar posição
  if (direction === 'up') {
    [data[index], data[index - 1]] = [data[index - 1], data[index]];
  } else {
    [data[index], data[index + 1]] = [data[index + 1], data[index]];
  }

  writeData(data);
  res.json({ message: 'Item reordenado', data });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});