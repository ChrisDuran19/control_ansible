# ⚡ Conductor - Plataforma de Automatización

![Status](https://img.shields.io/badge/status-demo-blue?style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-16+-green?style=flat-square&logo=node.js)
![Docker](https://img.shields.io/badge/Docker-Supported-blue?style=flat-square&logo=docker)
![Terraform](https://img.shields.io/badge/Terraform-Automation-purple?style=flat-square&logo=terraform)
![License](https://img.shields.io/badge/license-propietaria-red?style=flat-square)

> **Propiedad intelectual de: Cristian David Duran Grimaldo**  
> © 2024 - Todos los derechos reservados

---

## 📑 Índice
- [📋 Descripción](#-descripción)
- [🚀 Características](#-características)
- [⚠️ Derechos de Autor](#️-derechos-de-autor)
- [📋 Requisitos Previos](#-requisitos-previos)
- [🛠️ Instalación](#️-instalación)
- [🚀 Ejecución](#-ejecución)
- [🌐 Acceso](#-acceso)
- [📖 Uso](#-uso)
- [🐛 Modo Demo](#-modo-demo)
- [📁 Estructura del Proyecto](#-estructura-del-proyecto)
- [🔧 Configuración Avanzada](#-configuración-avanzada)
- [🚢 Despliegue](#-despliegue)
- [📊 Monitoreo](#-monitoreo)
- [📞 Contacto](#-contacto-del-autor)
- [📝 Licencia](#-licencia)
- [🆘 Soporte](#-soporte)
- [📅 Roadmap](#-roadmap)

---

## 📋 Descripción
Conductor es una plataforma **web propietaria** para ejecutar y gestionar **playbooks de Ansible** y operaciones de **Terraform** de manera centralizada.

---

## 🚀 Características
✅ Ejecución de Playbooks Ansible con logs en tiempo real  
✅ Operaciones Terraform (plan, apply, destroy)  
✅ Dashboard web con interfaz moderna  
✅ Logs en tiempo real con Socket.IO  
✅ Gestión de inventarios de Ansible  
✅ Ejecución en contenedores Docker para aislamiento  
✅ Colas de trabajos con procesamiento asíncrono  

---

## ⚠️ Derechos de Autor
Este software es **propiedad exclusiva** de **Cristian David Duran Grimaldo**.  

**Permisos:**
- ✔ Uso personal y educativo  
- ✔ Modificaciones para uso propio  
- ✔ Contribuciones mediante *fork* (manteniendo autoría)  

**Prohibido:**
- ❌ Distribución comercial  
- ❌ Reclamar autoría  
- ❌ Modificación de licencia  
- ❌ Uso en proyectos comerciales sin licencia  

---

## 📋 Requisitos Previos
<details>
<summary>🔽 Ver requisitos</summary>

- Node.js 16+  
- Docker y Docker Compose  
- Git  
- Navegador web moderno  

</details>

---

## 🛠️ Instalación
```bash
# 1. Clonar repositorio
git clone https://github.com/ChrisDuran19/control_ansible.git
cd control_ansible

# 2. Instalar dependencias backend
cd backend
npm install

# 3. Instalar dependencias frontend
cd ../frontend
npm install
```

**Variables de entorno:**
```env
PORT=3000
NODE_ENV=development
DOCKER_SOCKET=/var/run/docker.sock
LOG_LEVEL=info
```

---

## 🚀 Ejecución
<details>
<summary>🔽 Desarrollo</summary>

```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm start
```
</details>

<details>
<summary>🔽 Producción con Docker</summary>

```bash
docker-compose up --build
# o en segundo plano
docker-compose up -d --build
```
</details>

---

## 🌐 Acceso
- Dashboard → [http://localhost:3000](http://localhost:3000)  
- API Health → [http://localhost:3000/health](http://localhost:3000/health)  
- API Docs → [http://localhost:3000/api/docs](http://localhost:3000/api/docs)  

---

## 📖 Uso
📌 **Ejemplo Ansible Playbook**
```bash
POST /api/ansible/playbook
{
  "name": "Deploy Web Server",
  "playbook": "deploy.yml",
  "inventory": "production",
  "variables": { "app_version": "1.0.0" }
}
```

📌 **Ejemplo Terraform Plan**
```bash
POST /api/terraform/plan
{
  "name": "AWS Infrastructure",
  "workingDir": "/terraform/aws",
  "variables": { "region": "us-east-1" }
}
```

---

## 🐛 Modo Demo
⚠ Actualmente Conductor funciona en **modo demo**:  
- Jobs simulados con *timeouts*  
- Datos en memoria (no persistentes)  
- Logs de ejemplo predefinidos  

---

## 📁 Estructura del Proyecto
```text
conductor/
├── backend/         # API y lógica principal
├── frontend/        # Interfaz web (Vue.js)
├── runners/         # Ejecutores Docker (Ansible/Terraform)
└── docker-compose.yml
```

---

## 🔧 Configuración Avanzada
```env
# Backend
PORT=3000
NODE_ENV=development
JWT_SECRET=tu_clave_secreta
LOG_LEVEL=info

# Docker
DOCKER_SOCKET=/var/run/docker.sock

# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/conductor
REDIS_URL=redis://localhost:6379
```

---

## 🚢 Despliegue
```bash
# Producción con Docker
docker-compose -f docker-compose.prod.yml up -d --build
```

```yaml
# Kubernetes (ejemplo en /deploy/kubernetes)
apiVersion: apps/v1
kind: Deployment
...
```

---

## 📊 Monitoreo
- Logs en consola y archivos  
- Métricas → `/health`  
- Logs en tiempo real vía **Socket.IO**  

---

## 📞 Contacto del Autor
👤 Cristian David Duran Grimaldo  
🌐 GitHub: [ChrisDuran19](https://github.com/ChrisDuran19)  
---

## 📝 Licencia
Este software es **propiedad intelectual** de **Cristian David Duran Grimaldo**.  
Uso **personal y educativo permitido** bajo condiciones:  
- Mantener *copyright* intacto  
- No modificar autoría  
- No uso comercial sin autorización  

---

## 🆘 Soporte
Si encuentras problemas:
1. Revisar logs del backend  
2. Verificar que Docker esté funcionando  
3. Comprobar puertos disponibles  

---

## 📅 Roadmap
- [x] Versión Demo  
- [x] Logs en tiempo real  
- [ ] Integración con base de datos  
- [ ] Sistema de usuarios y roles  
- [ ] Despliegue en Kubernetes con CI/CD  
