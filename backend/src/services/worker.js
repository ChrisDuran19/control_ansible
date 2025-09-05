const { Worker } = require('bullmq');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { pool } = require('../models/database');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

const worker = new Worker('conductor-jobs', async job => {
  console.log(`🔄 Procesando job ${job.id}: ${job.name}`);
  
  try {
    // Actualizar estado en BD si existe conexión
    if (pool) {
      await pool.query(
        'UPDATE jobs SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['running', job.data.dbJobId]
      ).catch(err => console.log('⚠️  BD no disponible:', err.message));
    }

    let result;

    switch (job.name) {
      case 'ansible-playbook':
        result = await runAnsiblePlaybook(job);
        break;
      case 'terraform-plan':
        result = await runTerraformPlan(job);
        break;
      case 'terraform-apply':
        result = await runTerraformApply(job);
        break;
      case 'test-echo':
        result = await runTestEcho(job);
        break;
      default:
        throw new Error(`Tipo de job desconocido: ${job.name}`);
    }

    // Actualizar resultado en BD si existe conexión
    if (pool) {
      await pool.query(
        'UPDATE jobs SET status = $1, result = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['completed', JSON.stringify(result), job.data.dbJobId]
      ).catch(err => console.log('⚠️  BD no disponible:', err.message));
    }

    // Emitir evento via WebSocket si está disponible
    if (global.io) {
      global.io.to(`job-${job.data.dbJobId}`).emit('job-completed', {
        jobId: job.data.dbJobId,
        result
      });
    }

    return result;

  } catch (error) {
    console.error(`❌ Error en job ${job.id}:`, error);
    
    // Actualizar estado de error en BD
    if (pool) {
      await pool.query(
        'UPDATE jobs SET status = $1, result = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['failed', JSON.stringify({ error: error.message }), job.data.dbJobId]
      ).catch(err => console.log('⚠️  BD no disponible:', err.message));
    }

    throw error;
  }
}, { 
  connection,
  concurrency: 3,
  removeOnComplete: 10,
  removeOnFail: 5
});

// Función simple de prueba
const runTestEcho = async (job) => {
  const { message } = job.data;
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        output: `Echo: ${message}`,
        timestamp: new Date().toISOString(),
        exitCode: 0
      });
    }, 2000); // Simular trabajo de 2 segundos
  });
};

const runAnsiblePlaybook = async (job) => {
  const { playbook, inventory, variables = {} } = job.data;
  
  // Crear directorio temporal
  const workDir = path.join(require('os').tmpdir(), `job-${job.id}`);
  
  try {
    await fs.mkdir(workDir, { recursive: true });

    // Crear archivo de inventario
    const inventoryPath = path.join(workDir, 'inventory.ini');
    if (typeof inventory === 'object') {
      // Convertir objeto a formato INI
      let inventoryContent = '';
      for (const [group, hosts] of Object.entries(inventory)) {
        inventoryContent += `[${group}]\n`;
        if (hosts.hosts) {
          for (const [host, vars] of Object.entries(hosts.hosts)) {
            inventoryContent += `${host}`;
            if (vars) {
              for (const [key, value] of Object.entries(vars)) {
                inventoryContent += ` ${key}=${value}`;
              }
            }
            inventoryContent += '\n';
          }
        }
        inventoryContent += '\n';
      }
      await fs.writeFile(inventoryPath, inventoryContent);
    } else {
      await fs.writeFile(inventoryPath, inventory);
    }

    // Crear archivo de playbook
    const playbookPath = path.join(workDir, 'playbook.yml');
    await fs.writeFile(playbookPath, playbook);

    // Crear archivo de variables si existen
    let extraVarsArg = '';
    if (Object.keys(variables).length > 0) {
      const varsPath = path.join(workDir, 'vars.yml');
      const yamlVars = Object.entries(variables)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');
      await fs.writeFile(varsPath, yamlVars);
      extraVarsArg = `--extra-vars @${varsPath}`;
    }

    // Verificar si Docker está disponible
    const dockerAvailable = await checkDockerAvailable();
    
    if (dockerAvailable) {
      return await runWithDocker(workDir, inventoryPath, playbookPath, extraVarsArg, job);
    } else {
      return await runWithLocalAnsible(workDir, inventoryPath, playbookPath, extraVarsArg, job);
    }

  } finally {
    // Limpiar directorio temporal
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (err) {
      console.log('⚠️  No se pudo limpiar directorio temporal:', err.message);
    }
  }
};

const checkDockerAvailable = async () => {
  return new Promise((resolve) => {
    const docker = spawn('docker', ['--version'], { stdio: 'ignore' });
    docker.on('close', (code) => {
      resolve(code === 0);
    });
    docker.on('error', () => {
      resolve(false);
    });
  });
};

const runWithDocker = async (workDir, inventoryPath, playbookPath, extraVarsArg, job) => {
  const dockerArgs = [
    'run', '--rm',
    '-v', `${workDir}:/workspace`,
    'quay.io/ansible/ansible-runner:latest',
    'ansible-playbook',
    '-i', '/workspace/inventory.ini',
    '/workspace/playbook.yml'
  ];

  if (extraVarsArg) {
    dockerArgs.push('--extra-vars', `@/workspace/vars.yml`);
  }

  return executeCommand('docker', dockerArgs, job);
};

const runWithLocalAnsible = async (workDir, inventoryPath, playbookPath, extraVarsArg, job) => {
  const ansibleArgs = [
    '-i', inventoryPath,
    playbookPath
  ];

  if (extraVarsArg) {
    ansibleArgs.push('--extra-vars', `@${path.join(workDir, 'vars.yml')}`);
  }

  return executeCommand('ansible-playbook', ansibleArgs, job);
};

const executeCommand = (command, args, job) => {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Ejecutando: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args);
    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      
      // Emitir logs en tiempo real si WebSocket está disponible
      if (global.io && job.data.dbJobId) {
        global.io.to(`job-${job.data.dbJobId}`).emit('job-log', {
          jobId: job.data.dbJobId,
          log: chunk,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(chunk);
    });

    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      error += chunk;
      console.error(chunk);
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ 
          output, 
          exitCode: code,
          duration: Date.now() - job.processedOn
        });
      } else {
        reject(new Error(`${command} falló con código ${code}:\n${error}`));
      }
    });

    process.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error(`${command} no está instalado o no está en el PATH`));
      } else {
        reject(err);
      }
    });
  });
};

const runTerraformPlan = async (job) => {
  const { workingDir, variables = {} } = job.data;
  
  // Simulación por ahora
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        output: 'Terraform plan ejecutado exitosamente (simulación)',
        plan: 'Plan: 1 to add, 0 to change, 0 to destroy',
        exitCode: 0
      });
    }, 3000);
  });
};

const runTerraformApply = async (job) => {
  const { workingDir, variables = {} } = job.data;
  
  // Simulación por ahora
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        output: 'Terraform apply ejecutado exitosamente (simulación)',
        applied: 'Apply complete! Resources: 1 added, 0 changed, 0 destroyed',
        exitCode: 0
      });
    }, 5000);
  });
};

// Event listeners
worker.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completado exitosamente`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} falló:`, err.message);
});

worker.on('error', (error) => {
  console.error('❌ Error en worker:', error);
});

console.log('🔧 Worker iniciado y esperando jobs...');

// Manejar cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando worker...');
  await worker.close();
  process.exit(0);
});

module.exports = worker;