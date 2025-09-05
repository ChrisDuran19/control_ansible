require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

// Hacer io disponible globalmente para los workers
global.io = io;

// Storage en memoria para demo
let jobs = [
  {
    id: 1,
    name: 'Deploy Web Server',
    type: 'ansible-playbook',
    status: 'completed',
    created_at: new Date().toISOString(),
    result: { output: 'Playbook ejecutado exitosamente', exitCode: 0 }
  },
  {
    id: 2,
    name: 'AWS Infrastructure',
    type: 'terraform-plan',
    status: 'running',
    created_at: new Date(Date.now() - 300000).toISOString()
  }
];

let inventories = [
  {
    id: 1,
    name: 'localhost',
    description: 'Inventario local para pruebas',
    hosts: {
      all: {
        hosts: {
          localhost: {
            ansible_connection: 'local',
            ansible_host: '127.0.0.1'
          }
        }
      }
    },
    created_at: new Date().toISOString()
  }
];

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Conductor API'
  });
});

// Jobs API
app.get('/api/jobs', async (req, res) => {
  try {
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = jobs.find(j => j.id == req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job no encontrado' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ansible Playbook Execution
app.post('/api/ansible/playbook', async (req, res) => {
  try {
    const { name, playbook, inventory, variables = {} } = req.body;
    
    if (!name || !playbook || !inventory) {
      return res.status(400).json({ 
        error: 'Faltan campos obligatorios: name, playbook, inventory' 
      });
    }

    // Crear nuevo job
    const newJob = {
      id: Date.now(),
      name,
      type: 'ansible-playbook',
      status: 'queued',
      created_at: new Date().toISOString(),
      payload: { playbook, inventory, variables }
    };

    jobs.unshift(newJob);

    // Simular procesamiento
    setTimeout(() => {
      // Actualizar a running
      const job = jobs.find(j => j.id === newJob.id);
      if (job) {
        job.status = 'running';
        job.started_at = new Date().toISOString();
        
        // Emitir log en tiempo real
        if (global.io) {
          global.io.emit('job-log', {
            jobId: newJob.id,
            log: `Iniciando ejecución del playbook "${name}"...\n`,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Simular finalización después de 5 segundos
      setTimeout(() => {
        const jobToComplete = jobs.find(j => j.id === newJob.id);
        if (jobToComplete) {
          jobToComplete.status = 'completed';
          jobToComplete.completed_at = new Date().toISOString();
          jobToComplete.result = {
            output: `Playbook "${name}" ejecutado exitosamente (simulación)\n\nTASK [Gathering Facts] ****\nok: [localhost]\n\nTASK [Debug message] ****\nok: [localhost] => {\n    "msg": "Playbook ejecutado desde Conductor"\n}\n\nPLAY RECAP ****\nlocalhost : ok=2    changed=0    unreachable=0    failed=0`,
            exitCode: 0
          };
          
          if (global.io) {
            global.io.emit('job-completed', {
              jobId: newJob.id,
              status: 'completed',
              result: jobToComplete.result
            });
          }
        }
      }, 4000);
      
    }, 1000);

    res.json({
      jobId: newJob.id,
      status: 'queued',
      message: 'Playbook encolado para ejecución'
    });

  } catch (error) {
    console.error('Error ejecutando playbook:', error);
    res.status(500).json({ error: error.message });
  }
});

// Terraform Operations
app.post('/api/terraform/plan', async (req, res) => {
  try {
    const { name, workingDir, variables = {} } = req.body;
    
    const newJob = {
      id: Date.now() + 1,
      name: `${name} - Plan`,
      type: 'terraform-plan',
      status: 'queued',
      created_at: new Date().toISOString(),
      payload: { workingDir, variables }
    };

    jobs.unshift(newJob);

    // Simular procesamiento
    setTimeout(() => {
      const job = jobs.find(j => j.id === newJob.id);
      if (job) {
        job.status = 'running';
        job.started_at = new Date().toISOString();
      }
      
      setTimeout(() => {
        const jobToComplete = jobs.find(j => j.id === newJob.id);
        if (jobToComplete) {
          jobToComplete.status = 'completed';
          jobToComplete.completed_at = new Date().toISOString();
          jobToComplete.result = {
            output: `Terraform plan completado (simulación)\n\nTerraform used the selected providers to generate the following execution plan.\nResource actions are indicated with the following symbols:\n  + create\n\nTerraform will perform the following actions:\n\n  # aws_instance.example will be created\n  + resource "aws_instance" "example" {\n      + ami                    = "ami-0c02fb55956c7d316"\n      + instance_type          = "t3.micro"\n    }\n\nPlan: 1 to add, 0 to change, 0 to destroy.`,
            plan: 'Plan: 1 to add, 0 to change, 0 to destroy',
            exitCode: 0
          };
          
          if (global.io) {
            global.io.emit('job-completed', {
              jobId: newJob.id,
              status: 'completed',
              result: jobToComplete.result
            });
          }
        }
      }, 6000);
      
    }, 1000);

    res.json({
      jobId: newJob.id,
      status: 'queued',
      message: 'Terraform plan encolado para ejecución'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/terraform/apply', async (req, res) => {
  try {
    const { name, workingDir, variables = {} } = req.body;
    
    const newJob = {
      id: Date.now() + 2,
      name: `${name} - Apply`,
      type: 'terraform-apply',
      status: 'queued',
      created_at: new Date().toISOString(),
      payload: { workingDir, variables }
    };

    jobs.unshift(newJob);

    // Simular procesamiento más largo para apply
    setTimeout(() => {
      const job = jobs.find(j => j.id === newJob.id);
      if (job) {
        job.status = 'running';
        job.started_at = new Date().toISOString();
      }
      
      setTimeout(() => {
        const jobToComplete = jobs.find(j => j.id === newJob.id);
        if (jobToComplete) {
          jobToComplete.status = 'completed';
          jobToComplete.completed_at = new Date().toISOString();
          jobToComplete.result = {
            output: `Terraform apply completado (simulación)\n\naws_instance.example: Creating...\naws_instance.example: Still creating... [10s elapsed]\naws_instance.example: Still creating... [20s elapsed]\naws_instance.example: Creation complete after 22s [id=i-0abc123def456]\n\nApply complete! Resources: 1 added, 0 changed, 0 destroyed.\n\nOutputs:\n\ninstance_ip = "54.123.45.67"`,
            applied: 'Apply complete! Resources: 1 added, 0 changed, 0 destroyed',
            exitCode: 0
          };
          
          if (global.io) {
            global.io.emit('job-completed', {
              jobId: newJob.id,
              status: 'completed',
              result: jobToComplete.result
            });
          }
        }
      }, 10000);
      
    }, 1000);

    res.json({
      jobId: newJob.id,
      status: 'queued',
      message: 'Terraform apply encolado para ejecución'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inventarios
app.get('/api/inventories', async (req, res) => {
  try {
    res.json(inventories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventories', async (req, res) => {
  try {
    const { name, description, hosts, variables = {} } = req.body;
    
    const newInventory = {
      id: Date.now(),
      name,
      description,
      hosts,
      variables,
      created_at: new Date().toISOString()
    };

    inventories.unshift(newInventory);
    res.json(newInventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint de prueba simple
app.post('/api/test/echo', async (req, res) => {
  try {
    const { message } = req.body;
    
    const newJob = {
      id: Date.now() + 3,
      name: `Echo: ${message}`,
      type: 'test-echo',
      status: 'completed',
      created_at: new Date().toISOString(),
      result: { output: `Echo: ${message}`, exitCode: 0 }
    };

    jobs.unshift(newJob);

    res.json({
      jobId: newJob.id,
      status: 'completed',
      message: `Echo job creado: ${message}`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO para logs en tiempo real
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  socket.on('subscribe-job', (jobId) => {
    socket.join(`job-${jobId}`);
    console.log(`Cliente suscrito a job ${jobId}`);
  });

  socket.on('unsubscribe-job', (jobId) => {
    socket.leave(`job-${jobId}`);
    console.log(`Cliente desuscrito del job ${jobId}`);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Servir el frontend en la raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Conductor Backend ejecutándose en puerto ${PORT}`);
  console.log(`📊 Dashboard disponible en http://localhost:${PORT}`);
  console.log(`🔧 Modo demo - Simulación de jobs`);
  console.log(`💾 Datos almacenados en memoria`);
});