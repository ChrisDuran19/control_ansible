// Conductor Frontend - Aplicación Principal
class ConductorApp {
    constructor() {
        this.socket = null;
        this.jobs = [];
        this.inventories = [];
        this.templates = [];
        this.schedules = [];
        this.logs = [];
        this.currentSection = 'dashboard';
        this.wsRetryCount = 0;
        this.maxRetries = 5;
        this.retryDelay = 3000;
        this.debounceTimers = new Map();
        this.eventHandlers = new Map();
    }

    // Inicialización principal
    init() {
        try {
            console.log('🚀 Inicializando Conductor App...');
            
            this.setupNavigation();
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            this.initializeWebSocket();
            this.loadInitialData();
            this.startPeriodicUpdates();
            this.updateConnectionStatus();
            this.loadUserPreferences();
            this.initializeTheme();
            
            // Cargar sección inicial desde URL
            this.loadInitialSection();
            
            console.log('✅ Conductor App inicializada correctamente');
            
        } catch (error) {
            console.error('❌ Error durante la inicialización:', error);
            this.showToast('Error durante la inicialización de la aplicación', 'error');
        }
    }

    // Cargar sección inicial desde URL
    loadInitialSection() {
        const urlParams = new URLSearchParams(window.location.search);
        const section = urlParams.get('section') || 'dashboard';
        this.switchSection(section);
    }

    // WebSocket/Socket.IO Connection (Fallback a polling si no hay WebSocket)
    initializeWebSocket() {
        try {
            if (typeof io !== 'undefined') {
                this.socket = io({
                    transports: ['websocket', 'polling'],
                    upgrade: true,
                    rememberUpgrade: true,
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionAttempts: 5,
                    timeout: 10000
                });
                this.setupSocketListeners();
            } else {
                console.warn('Socket.IO no disponible, usando polling');
                this.setupPollingFallback();
            }
        } catch (error) {
            console.warn('Error inicializando WebSocket:', error);
            this.setupPollingFallback();
        }
    }

    setupSocketListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ Conectado al servidor via WebSocket');
            this.wsRetryCount = 0;
            this.updateConnectionStatus(true);
            this.showToast('Conectado al servidor', 'success');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Desconectado del servidor:', reason);
            this.updateConnectionStatus(false);
            if (reason === 'io server disconnect') {
                this.socket.connect();
            }
            this.attemptReconnect();
        });

        this.socket.on('connect_error', (error) => {
            console.error('Error de conexión:', error);
            this.attemptReconnect();
        });

        this.socket.on('job-update', (data) => {
            console.log('📝 Actualización de job:', data);
            this.handleJobUpdate(data);
        });

        this.socket.on('job-completed', (data) => {
            console.log('🎉 Job completado:', data);
            this.showToast(`Job ${data.name} completado`, 'success');
            this.refreshJobs();
            this.updateDashboardStats();
        });

        this.socket.on('job-failed', (data) => {
            console.log('❌ Job falló:', data);
            this.showToast(`Job ${data.name} falló`, 'error');
            this.refreshJobs();
        });

        this.socket.on('job-log', (data) => {
            this.handleJobLog(data);
        });

        this.socket.on('system-status', (data) => {
            this.updateSystemMetrics(data);
        });
    }

    setupPollingFallback() {
        console.log('🔄 Configurando polling fallback');
        this.pollingInterval = setInterval(() => {
            this.pollServerStatus();
        }, 5000);
    }

    async pollServerStatus() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            // Simulamos una respuesta exitosa ya que no tenemos servidor real
            clearTimeout(timeoutId);
            this.updateConnectionStatus(true);
            
            // Mock data para el estado del sistema
            const mockData = this.generateMockMetrics();
            this.updateSystemMetrics(mockData);
            
        } catch (error) {
            this.updateConnectionStatus(false);
        }
    }

    attemptReconnect() {
        if (this.wsRetryCount < this.maxRetries) {
            this.wsRetryCount++;
            console.log(`🔄 Reintentando conexión (${this.wsRetryCount}/${this.maxRetries})...`);
            setTimeout(() => {
                if (this.socket) {
                    this.socket.connect();
                }
            }, this.retryDelay * this.wsRetryCount);
        } else {
            console.warn('❌ Máximo de reintentos alcanzado, usando polling');
            this.setupPollingFallback();
        }
    }

    // Navegación y UI
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const mobileMenu = document.getElementById('mobile-menu');

        navButtons.forEach(btn => {
            const handler = () => {
                const section = btn.dataset.section;
                this.switchSection(section);
            };
            btn.addEventListener('click', handler);
            this.eventHandlers.set(btn, handler);
        });

        if (sidebarToggle) {
            const handler = () => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('collapsed');
                    this.saveUserPreferences();
                }
            };
            sidebarToggle.addEventListener('click', handler);
            this.eventHandlers.set(sidebarToggle, handler);
        }

        if (mobileMenu) {
            const handler = () => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('mobile-open');
                }
            };
            mobileMenu.addEventListener('click', handler);
            this.eventHandlers.set(mobileMenu, handler);
        }
    }

    switchSection(sectionName) {
        console.log('Switching to section:', sectionName);
        
        this.currentSection = sectionName;
        
        // Actualizar navegación activa
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionName);
        });

        // Actualizar breadcrumb
        const breadcrumb = document.getElementById('current-section');
        if (breadcrumb) {
            breadcrumb.textContent = this.getSectionTitle(sectionName);
        }

        // Ocultar todas las secciones
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Mostrar sección objetivo
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        } else {
            console.warn(`Sección no encontrada: ${sectionName}-section`);
        }

        // Cargar datos de la sección
        this.loadSectionData(sectionName);
        
        // Cerrar sidebar móvil
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
        }
        
        // Actualizar URL
        this.updateURL(sectionName);
    }

    updateURL(section) {
        const url = new URL(window.location);
        url.searchParams.set('section', section);
        window.history.pushState({ section }, '', url);
    }

    getSectionTitle(sectionName) {
        const titles = {
            dashboard: 'Dashboard',
            jobs: 'Jobs',
            ansible: 'Ansible',
            terraform: 'Terraform', 
            inventories: 'Inventarios',
            templates: 'Templates',
            schedules: 'Programación',
            logs: 'Logs',
            settings: 'Configuración'
        };
        return titles[sectionName] || sectionName;
    }

    // Event Listeners mejorados
    setupEventListeners() {
        this.setupFormListeners();
        this.setupModalListeners();
        this.setupSearchListeners();
        this.setupFilterListeners();
        this.setupUserMenuListeners();
        this.setupHistoryListener();
        this.setupResizeListener();
        this.setupTooltips();
    }

    setupHistoryListener() {
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.section) {
                this.switchSection(event.state.section);
            }
        });
    }

    setupResizeListener() {
        const resizeHandler = this.debounce(() => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                if (window.innerWidth <= 768) {
                    sidebar.classList.add('mobile');
                } else {
                    sidebar.classList.remove('mobile', 'mobile-open');
                }
            }
        }, 250);
        
        window.addEventListener('resize', resizeHandler);
    }

    setupFormListeners() {
        // Form listeners se configurarán cuando sea necesario
        this.setupAnsibleFormListener();
        this.setupTerraformFormListener();
        this.setupInventoryFormListener();
        this.setupSettingsFormListener();
    }

    setupAnsibleFormListener() {
        const ansibleForm = document.getElementById('ansible-form');
        if (ansibleForm) {
            const handler = (e) => {
                e.preventDefault();
                this.executePlaybook();
            };
            ansibleForm.addEventListener('submit', handler);
            this.eventHandlers.set(ansibleForm, handler);
        }
    }

    setupTerraformFormListener() {
        const terraformForm = document.getElementById('terraform-form');
        if (terraformForm) {
            const handler = (e) => {
                e.preventDefault();
                console.log('Terraform form submitted');
            };
            terraformForm.addEventListener('submit', handler);
            this.eventHandlers.set(terraformForm, handler);
        }
    }

    setupInventoryFormListener() {
        const inventoryForm = document.getElementById('inventory-form');
        if (inventoryForm) {
            const handler = (e) => {
                e.preventDefault();
                this.createInventory();
            };
            inventoryForm.addEventListener('submit', handler);
            this.eventHandlers.set(inventoryForm, handler);
        }
    }

    setupSettingsFormListener() {
        const settingsForms = document.querySelectorAll('.settings-form');
        settingsForms.forEach(form => {
            const handler = () => {
                this.markSettingsChanged();
            };
            form.addEventListener('change', handler);
            this.eventHandlers.set(form, handler);
        });
    }

    setupModalListeners() {
        const windowClickHandler = (event) => {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (event.target === modal && modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
            });
        };
        window.addEventListener('click', windowClickHandler);
        this.eventHandlers.set(window, windowClickHandler);

        const escapeHandler = (event) => {
            if (event.key === 'Escape') {
                const openModal = document.querySelector('.modal[style*="block"]');
                if (openModal) {
                    openModal.style.display = 'none';
                }
            }
        };
        document.addEventListener('keydown', escapeHandler);
        this.eventHandlers.set(document, escapeHandler);
    }

    setupSearchListeners() {
        const globalSearch = document.getElementById('global-search');
        if (globalSearch) {
            const handler = this.debounce((e) => {
                this.performGlobalSearch(e.target.value);
            }, 300);
            globalSearch.addEventListener('input', handler);
            this.eventHandlers.set(globalSearch, handler);
        }

        const searches = {
            'jobs-search': () => this.filterJobs(),
            'inventories-search': () => this.filterInventories(),
            'logs-search': () => this.filterLogs()
        };

        Object.entries(searches).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                const debouncedHandler = this.debounce(handler, 300);
                element.addEventListener('input', debouncedHandler);
                this.eventHandlers.set(element, debouncedHandler);
            }
        });
    }

    setupFilterListeners() {
        const jobFilters = ['job-status-filter', 'job-type-filter'];
        jobFilters.forEach(filterId => {
            const filter = document.getElementById(filterId);
            if (filter) {
                const handler = () => this.filterJobs();
                filter.addEventListener('change', handler);
                this.eventHandlers.set(filter, handler);
            }
        });

        const logFilters = ['log-level-filter', 'log-date-filter'];
        logFilters.forEach(filterId => {
            const filter = document.getElementById(filterId);
            if (filter) {
                const handler = () => this.filterLogs();
                filter.addEventListener('change', handler);
                this.eventHandlers.set(filter, handler);
            }
        });
    }

    setupUserMenuListeners() {
        const userMenuBtn = document.getElementById('user-menu-btn');
        const userDropdown = document.getElementById('user-dropdown');
        const notificationsBtn = document.getElementById('notifications-btn');
        const notificationsDropdown = document.getElementById('notifications-dropdown');

        if (userMenuBtn && userDropdown) {
            const handler = (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('show');
                if (notificationsDropdown) {
                    notificationsDropdown.classList.remove('show');
                }
            };
            userMenuBtn.addEventListener('click', handler);
            this.eventHandlers.set(userMenuBtn, handler);
        }

        if (notificationsBtn && notificationsDropdown) {
            const handler = (e) => {
                e.stopPropagation();
                notificationsDropdown.classList.toggle('show');
                if (userDropdown) {
                    userDropdown.classList.remove('show');
                }
                this.loadNotifications();
            };
            notificationsBtn.addEventListener('click', handler);
            this.eventHandlers.set(notificationsBtn, handler);
        }

        const documentClickHandler = () => {
            if (userDropdown) userDropdown.classList.remove('show');
            if (notificationsDropdown) notificationsDropdown.classList.remove('show');
        };
        document.addEventListener('click', documentClickHandler);
        this.eventHandlers.set(document, documentClickHandler);
    }

    setupKeyboardShortcuts() {
        const keyboardHandler = (event) => {
            if (event.ctrlKey && event.key === 'k') {
                event.preventDefault();
                const globalSearch = document.getElementById('global-search');
                if (globalSearch) {
                    globalSearch.focus();
                }
            }

            if (event.ctrlKey && event.key === 'r') {
                event.preventDefault();
                this.refreshCurrentSection();
            }

            if (event.ctrlKey && event.key >= '1' && event.key <= '9') {
                event.preventDefault();
                const sections = ['dashboard', 'jobs', 'ansible', 'terraform', 'inventories', 'templates', 'schedules', 'logs', 'settings'];
                const index = parseInt(event.key) - 1;
                if (sections[index]) {
                    this.switchSection(sections[index]);
                }
            }

            if (event.key === 'Escape') {
                this.closeAllModalsAndDropdowns();
            }
        };
        document.addEventListener('keydown', keyboardHandler);
        this.eventHandlers.set(document, keyboardHandler);
    }

    setupTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', this.showTooltip.bind(this));
            element.addEventListener('mouseleave', this.hideTooltip.bind(this));
        });
    }

    // Funciones de utilidad mejoradas
    showTooltip(event) {
        const element = event.target;
        const text = element.dataset.tooltip;
        if (!text) return;

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        tooltip.id = 'active-tooltip';
        
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
        
        setTimeout(() => tooltip.classList.add('show'), 10);
    }

    hideTooltip() {
        const tooltip = document.getElementById('active-tooltip');
        if (tooltip) {
            tooltip.classList.remove('show');
            setTimeout(() => tooltip.remove(), 200);
        }
    }

    closeAllModalsAndDropdowns() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        
        document.querySelectorAll('.dropdown-menu.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }

    // Data Loading y Management mejorado
    async loadInitialData() {
        try {
            this.showProgressIndicator(true);
            
            // Usar datos mock mientras no hay backend
            this.jobs = this.generateMockJobs();
            this.inventories = this.generateMockInventories();
            this.templates = this.generateMockTemplates();
            this.logs = this.generateMockLogs();
            
            console.log('✅ Datos iniciales cargados');
        } catch (error) {
            console.error('❌ Error cargando datos iniciales:', error);
            this.showToast('Error cargando datos iniciales', 'error');
        } finally {
            this.showProgressIndicator(false);
        }
    }

    async loadSectionData(sectionName) {
        try {
            this.showProgressIndicator(true);
            
            switch (sectionName) {
                case 'dashboard':
                    await this.loadDashboard();
                    break;
                case 'jobs':
                    await this.loadJobs();
                    break;
                case 'inventories':
                    await this.loadInventories();
                    break;
                case 'templates':
                    await this.loadTemplates();
                    break;
                case 'schedules':
                    await this.loadSchedules();
                    break;
                case 'logs':
                    await this.loadLogs();
                    break;
                case 'ansible':
                    await this.loadPlaybookTemplates();
                    break;
                case 'terraform':
                    await this.loadTerraformTemplates();
                    break;
                case 'settings':
                    console.log('Cargando configuración');
                    break;
            }
        } catch (error) {
            console.warn(`Error loading ${sectionName} data:`, error);
        } finally {
            this.showProgressIndicator(false);
        }
    }

    async loadDashboard() {
        this.updateDashboardStats();
        this.loadRecentActivity();
        this.updateSystemMetrics(this.generateMockMetrics());
    }

    async loadJobs() {
        this.renderJobsList();
        this.updateJobsBadge();
    }

    async loadInventories() {
        this.renderInventoriesList();
        this.populateInventorySelect();
    }

    async loadTemplates() {
        this.renderTemplatesList();
    }

    async loadSchedules() {
        this.renderSchedulesList();
    }

    async loadLogs() {
        this.renderLogsList();
    }

    async loadPlaybookTemplates() {
        this.populateInventorySelect();
        this.renderTemplatesList();
    }

    async loadTerraformTemplates() {
        this.renderTemplatesList();
    }

    // Funciones de mock data
    generateMockJobs() {
        return [
            {
                id: 1,
                name: 'Deploy Web Server',
                type: 'ansible',
                status: 'completed',
                created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                completed_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
                duration: '5m 30s',
                output: 'PLAY [webservers] ********************************************************\n\nTASK [Gathering Facts] *****************************************************\nok: [web1]\nok: [web2]\n\nTASK [Install nginx] ******************************************************\nchanged: [web1]\nchanged: [web2]\n\nPLAY RECAP ****************************************************************\nweb1                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0\nweb2                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0'
            },
            {
                id: 2,
                name: 'Database Backup',
                type: 'ansible',
                status: 'running',
                created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
                duration: '5m 12s',
                output: 'PLAY [databases] *********************************************************\n\nTASK [Gathering Facts] *****************************************************\nok: [db1]\n\nTASK [Create backup directory] ********************************************\nchanged: [db1]\n\nTASK [Running backup script] **********************************************\n[En progreso...]'
            },
            {
                id: 3,
                name: 'Terraform Plan AWS',
                type: 'terraform-plan',
                status: 'failed',
                created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
                completed_at: new Date(Date.now() - 1000 * 60 * 58).toISOString(),
                duration: '2m 15s',
                output: 'Error: Invalid provider configuration\n\nError: The argument "region" is required, but no definition was found.\n\n  on main.tf line 1, in provider "aws":\n   1: provider "aws" {\n\nError: Failed to query available provider packages'
            }
        ];
    }

    generateMockInventories() {
        return [
            {
                id: 1,
                name: 'Producción Web',
                description: 'Servidores web de producción',
                type: 'static',
                hosts: {
                    webservers: {
                        hosts: {
                            web1: { ansible_host: '192.168.1.10', ansible_user: 'ubuntu' },
                            web2: { ansible_host: '192.168.1.11', ansible_user: 'ubuntu' }
                        }
                    },
                    databases: {
                        hosts: {
                            db1: { ansible_host: '192.168.1.20', ansible_user: 'postgres' }
                        }
                    }
                },
                created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
            }
        ];
    }

    generateMockTemplates() {
        return [
            {
                id: 1,
                name: 'Basic Web Server Setup',
                type: 'ansible',
                description: 'Configuración básica de servidor web con Nginx',
                content: '---\n- name: Basic web server setup\n  hosts: webservers\n  become: yes\n  tasks:\n    - name: Install nginx\n      package:\n        name: nginx\n        state: present\n    \n    - name: Start nginx\n      service:\n        name: nginx\n        state: started\n        enabled: yes',
                created_at: new Date().toISOString()
            }
        ];
    }

    generateMockLogs() {
        return [
            {
                id: 1,
                timestamp: new Date().toISOString(),
                level: 'info',
                message: 'Job "Deploy Web Server" completed successfully',
                source: 'conductor.jobs'
            },
            {
                id: 2,
                timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
                level: 'warning',
                message: 'High memory usage detected: 85%',
                source: 'conductor.system'
            }
        ];
    }

    generateMockMetrics() {
        return {
            cpu: Math.floor(Math.random() * 40) + 20,
            memory: Math.floor(Math.random() * 30) + 40,
            disk: Math.floor(Math.random() * 20) + 20
        };
    }

    // Dashboard Operations mejoradas
    updateDashboardStats() {
        const totalJobs = this.jobs.length;
        const runningJobs = this.jobs.filter(job => job.status === 'running').length;
        const completedJobs = this.jobs.filter(job => job.status === 'completed').length;
        const failedJobs = this.jobs.filter(job => job.status === 'failed').length;
        const hostsCount = this.inventories.reduce((total, inv) => {
            return total + this.countHosts(inv.hosts || {});
        }, 0);

        this.animateStatUpdate('total-jobs', totalJobs);
        this.animateStatUpdate('running-jobs', runningJobs);
        this.animateStatUpdate('completed-jobs', completedJobs);
        this.animateStatUpdate('total-hosts', hostsCount);

        this.updateBadge('active-jobs-badge', runningJobs);
    }

    animateStatUpdate(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const currentValue = parseInt(element.textContent) || 0;
        
        if (currentValue === newValue) return;

        const duration = 800;
        const startTime = performance.now();
        const difference = newValue - currentValue;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeProgress = progress * (2 - progress);
            const value = Math.round(currentValue + (difference * easeProgress));
            
            element.textContent = value;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
        
        element.classList.add('stat-updated');
        setTimeout(() => element.classList.remove('stat-updated'), 300);
    }

    updateBadge(badgeId, count) {
        const badge = document.getElementById(badgeId);
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline' : 'none';
            
            if (count > 0) {
                badge.classList.add('badge-pulse');
                setTimeout(() => badge.classList.remove('badge-pulse'), 1000);
            }
        }
    }

    loadRecentActivity() {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;

        const recentJobs = [...this.jobs]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10);
        
        if (recentJobs.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history fa-2x"></i>
                    <p>No hay actividad reciente</p>
                </div>
            `;
            return;
        }

        activityList.innerHTML = recentJobs.map(job => `
            <div class="activity-item" onclick="conductor.showJobDetails(${job.id})">
                <div class="activity-icon">
                    <i class="fas ${this.getJobIcon(job.type)}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${job.name}</div>
                    <div class="activity-meta">
                        <span class="activity-type">${job.type}</span>
                        <span class="activity-time">${this.formatTime(job.created_at)}</span>
                    </div>
                </div>
                <div class="activity-status">
                    <span class="status-badge ${job.status}">${this.getStatusText(job.status)}</span>
                </div>
            </div>
        `).join('');
    }

    // Render functions
    renderJobsList() {
        const jobsList = document.getElementById('jobs-list');
        if (!jobsList) return;

        const filteredJobs = this.filterJobsData();
        
        if (filteredJobs.length === 0) {
            jobsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tasks fa-3x"></i>
                    <h3>No hay jobs</h3>
                    <p>Crea tu primer job para comenzar</p>
                    <button class="btn btn-primary" onclick="conductor.switchSection('ansible')">
                        <i class="fas fa-plus"></i>
                        Crear Job
                    </button>
                </div>
            `;
            return;
        }

        jobsList.innerHTML = filteredJobs.map(job => `
            <div class="job-item" onclick="conductor.showJobDetails(${job.id})">
                <div class="job-header">
                    <div class="job-title">
                        <i class="fas ${this.getJobIcon(job.type)}"></i>
                        <h4>${job.name}</h4>
                    </div>
                    <div class="job-actions">
                        <span class="status-badge ${job.status}">${this.getStatusText(job.status)}</span>
                        <button class="btn-icon" onclick="event.stopPropagation(); conductor.copyJobOutput(${job.id})" title="Copiar salida">
                            <i class="fas fa-copy"></i>
                        </button>
                        ${job.status === 'running' ? `
                        <button class="btn-icon" onclick="event.stopPropagation(); conductor.stopJob(${job.id})" title="Detener job">
                            <i class="fas fa-stop"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
                <div class="job-details">
                    <div class="job-meta">
                        <span><i class="fas fa-clock"></i> ${this.formatTime(job.created_at)}</span>
                        ${job.duration ? `<span><i class="fas fa-hourglass-half"></i> ${job.duration}</span>` : ''}
                    </div>
                    <div class="job-preview">
                        <pre>${this.truncateOutput(job.output || '', 200)}</pre>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderInventoriesList() {
        const inventoriesList = document.getElementById('inventories-list');
        if (!inventoriesList) return;

        if (this.inventories.length === 0) {
            inventoriesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-list fa-3x"></i>
                    <h3>No hay inventarios</h3>
                    <p>Crea tu primer inventario para comenzar</p>
                    <button class="btn btn-primary" onclick="conductor.showCreateInventoryModal()">
                        <i class="fas fa-plus"></i>
                        Crear Inventario
                    </button>
                </div>
            `;
            return;
        }

        inventoriesList.innerHTML = this.inventories.map(inv => `
            <div class="inventory-card">
                <div class="inventory-header">
                    <h4>${inv.name}</h4>
                    <span class="badge ${inv.type}">${inv.type}</span>
                </div>
                <div class="inventory-body">
                    <p>${inv.description || 'Sin descripción'}</p>
                    <div class="inventory-stats">
                        <span><i class="fas fa-server"></i> ${this.countHosts(inv.hosts || {})} hosts</span>
                        <span><i class="fas fa-calendar"></i> ${this.formatTime(inv.created_at)}</span>
                    </div>
                </div>
                <div class="inventory-actions">
                    <button class="btn btn-sm" onclick="conductor.editInventory(${inv.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="conductor.deleteInventory(${inv.id})">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderTemplatesList() {
        const ansibleTemplates = document.getElementById('ansible-templates');
        const terraformTemplates = document.getElementById('terraform-templates');
        
        if (ansibleTemplates) {
            const ansibleTemplatesData = this.templates.filter(t => t.type === 'ansible');
            ansibleTemplates.innerHTML = ansibleTemplatesData.map(t => `
                <div class="template-item" onclick="conductor.loadTemplate(${t.id})">
                    <i class="fas fa-file-code"></i>
                    <span>${t.name}</span>
                    <small>${t.description}</small>
                </div>
            `).join('');
        }
        
        if (terraformTemplates) {
            const terraformTemplatesData = this.templates.filter(t => t.type === 'terraform');
            terraformTemplates.innerHTML = terraformTemplatesData.map(t => `
                <div class="template-item" onclick="conductor.loadTemplate(${t.id})">
                    <i class="fas fa-cloud"></i>
                    <span>${t.name}</span>
                    <small>${t.description}</small>
                </div>
            `).join('');
        }
    }

    renderLogsList() {
        const logsList = document.getElementById('logs-list');
        if (!logsList) return;

        const filteredLogs = this.filterLogsData();
        
        if (filteredLogs.length === 0) {
            logsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt fa-3x"></i>
                    <h3>No hay logs</h3>
                    <p>Los logs aparecerán aquí cuando se ejecuten jobs</p>
                </div>
            `;
            return;
        }

        logsList.innerHTML = filteredLogs.map(log => `
            <div class="log-item ${log.level}">
                <div class="log-level">
                    <i class="fas ${this.getLogIcon(log.level)}"></i>
                </div>
                <div class="log-content">
                    <div class="log-message">${log.message}</div>
                    <div class="log-meta">
                        <span class="log-time">${this.formatTime(log.timestamp)}</span>
                        <span class="log-source">${log.source}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderSchedulesList() {
        const schedulesList = document.getElementById('schedules-list');
        if (!schedulesList) return;

        if (this.schedules.length === 0) {
            schedulesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar fa-3x"></i>
                    <h3>No hay programaciones</h3>
                    <p>Crea tu primera programación para ejecutar jobs automáticamente</p>
                    <button class="btn btn-primary" onclick="conductor.createSchedule()">
                        <i class="fas fa-plus"></i>
                        Crear Programación
                    </button>
                </div>
            `;
            return;
        }

        // Implementar renderizado de programaciones
    }

    // Funciones de filtrado
    filterJobsData() {
        const searchTerm = document.getElementById('jobs-search')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('job-status-filter')?.value || '';
        const typeFilter = document.getElementById('job-type-filter')?.value || '';

        return this.jobs.filter(job => {
            const matchesSearch = job.name.toLowerCase().includes(searchTerm) || 
                                (job.output && job.output.toLowerCase().includes(searchTerm));
            const matchesStatus = statusFilter === '' || job.status === statusFilter;
            const matchesType = typeFilter === '' || job.type.includes(typeFilter);
            
            return matchesSearch && matchesStatus && matchesType;
        });
    }

    filterLogsData() {
        const searchTerm = document.getElementById('logs-search')?.value.toLowerCase() || '';
        const levelFilter = document.getElementById('log-level-filter')?.value || '';
        const dateFilter = document.getElementById('log-date-filter')?.value || '';

        return this.logs.filter(log => {
            const matchesSearch = log.message.toLowerCase().includes(searchTerm) || 
                                log.source.toLowerCase().includes(searchTerm);
            const matchesLevel = levelFilter === '' || log.level === levelFilter;
            
            let matchesDate = true;
            if (dateFilter) {
                const logDate = new Date(log.timestamp).toLocaleDateString();
                const filterDate = new Date(dateFilter).toLocaleDateString();
                matchesDate = logDate === filterDate;
            }
            
            return matchesSearch && matchesLevel && matchesDate;
        });
    }

    filterJobs() {
        this.renderJobsList();
    }

    filterLogs() {
        this.renderLogsList();
    }

    filterInventories() {
        this.renderInventoriesList();
    }

    // Funciones de utilidad
    debounce(func, wait) {
        return (...args) => {
            clearTimeout(this.debounceTimers.get(func));
            this.debounceTimers.set(func, setTimeout(() => func.apply(this, args), wait));
        };
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Justo ahora';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours} h`;
        if (diffDays < 7) return `Hace ${diffDays} d`;
        
        return date.toLocaleDateString();
    }

    getJobIcon(type) {
        const icons = {
            'ansible': 'fa-server',
            'terraform-plan': 'fa-search',
            'terraform-apply': 'fa-rocket',
            'terraform-destroy': 'fa-trash'
        };
        return icons[type] || 'fa-tasks';
    }

    getStatusText(status) {
        const statusText = {
            'running': 'En ejecución',
            'completed': 'Completado',
            'failed': 'Fallido',
            'pending': 'Pendiente'
        };
        return statusText[status] || status;
    }

    getLogIcon(level) {
        const icons = {
            'info': 'fa-info-circle',
            'warning': 'fa-exclamation-triangle',
            'error': 'fa-exclamation-circle',
            'debug': 'fa-bug'
        };
        return icons[level] || 'fa-info-circle';
    }

    truncateOutput(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    countHosts(hostsObj) {
        let count = 0;
        for (const group in hostsObj) {
            if (hostsObj[group].hosts) {
                count += Object.keys(hostsObj[group].hosts).length;
            }
        }
        return count;
    }

    // Funciones de UI
    showProgressIndicator(show) {
        const indicator = document.getElementById('progress-indicator');
        if (indicator) {
            indicator.style.display = show ? 'block' : 'none';
        }
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        toastContainer.appendChild(toast);

        // Animar entrada
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    updateConnectionStatus(online = true) {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;

        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('.status-text');

        if (online) {
            indicator.className = 'status-indicator online';
            text.textContent = 'Online';
        } else {
            indicator.className = 'status-indicator offline';
            text.textContent = 'Offline';
        }
    }

    updateSystemMetrics(data) {
        const metrics = ['cpu', 'memory', 'disk'];
        metrics.forEach(metric => {
            const fill = document.querySelector(`.metric-fill[data-value="${data[metric]}"]`);
            const value = document.querySelector(`.metric-value[data-value="${data[metric]}"]`);
            
            if (fill) {
                fill.style.width = `${data[metric]}%`;
                fill.className = `metric-fill ${this.getMetricClass(data[metric])}`;
            }
            
            if (value) {
                value.textContent = `${data[metric]}%`;
            }
        });
    }

    getMetricClass(value) {
        if (value > 80) return 'critical';
        if (value > 60) return 'warning';
        return 'normal';
    }

    // Funciones de modal
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showJobDetails(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job) return;

        const modal = document.getElementById('job-modal');
        if (!modal) return;

        document.getElementById('job-modal-title').textContent = job.name;
        document.getElementById('job-modal-status').textContent = this.getStatusText(job.status);
        document.getElementById('job-modal-status').className = `status-badge ${job.status}`;
        document.getElementById('job-modal-duration').textContent = job.duration || 'N/A';
        document.getElementById('job-modal-start-time').textContent = this.formatTime(job.created_at);
        document.getElementById('job-modal-end-time').textContent = job.completed_at ? this.formatTime(job.completed_at) : 'N/A';
        document.getElementById('job-output').textContent = job.output || 'No hay salida disponible';

        modal.style.display = 'block';
    }

    closeJobModal() {
        this.closeModal('job-modal');
    }

    showCreateInventoryModal() {
        this.showModal('inventory-modal');
    }

    closeInventoryModal() {
        this.closeModal('inventory-modal');
    }

    showQuickJobModal() {
        this.showModal('quick-job-modal');
    }

    closeQuickJobModal() {
        this.closeModal('quick-job-modal');
    }

    // Funciones de negocio
    refreshDashboard() {
        this.updateDashboardStats();
        this.loadRecentActivity();
        this.showToast('Dashboard actualizado', 'success');
    }

    refreshJobs() {
        this.renderJobsList();
        this.showToast('Jobs actualizados', 'success');
    }

    refreshCurrentSection() {
        this.loadSectionData(this.currentSection);
        this.showToast(`${this.getSectionTitle(this.currentSection)} actualizado`, 'success');
    }

    executePlaybook() {
        const name = document.getElementById('playbook-name').value;
        const content = document.getElementById('playbook-content').value;
        
        if (!name || !content) {
            this.showToast('Nombre y contenido del playbook son requeridos', 'error');
            return;
        }

        this.showProgressIndicator(true);
        
        // Simular ejecución
        setTimeout(() => {
            this.showProgressIndicator(false);
            
            // Crear un job simulado
            const newJob = {
                id: Date.now(),
                name: name,
                type: 'ansible',
                status: 'running',
                created_at: new Date().toISOString(),
                output: 'Iniciando ejecución del playbook...'
            };
            
            this.jobs.unshift(newJob);
            this.updateDashboardStats();
            this.showToast('Playbook ejecutándose', 'success');
            
            // Simular finalización después de 5 segundos
            setTimeout(() => {
                newJob.status = 'completed';
                newJob.completed_at = new Date().toISOString();
                newJob.duration = '5s';
                newJob.output = 'PLAY [all] ***********************************************************\n\nTASK [Gathering Facts] *****************************************************\nok: [localhost]\n\nPLAY RECAP ****************************************************************\nlocalhost                  : ok=1    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0';
                
                this.updateDashboardStats();
                this.showToast('Playbook completado', 'success');
            }, 5000);
        }, 1000);
    }

    createInventory() {
        const name = document.getElementById('inventory-name').value;
        const description = document.getElementById('inventory-description').value;
        const type = document.querySelector('input[name="inventory-type"]:checked').value;
        const hosts = document.getElementById('inventory-hosts').value;
        
        if (!name) {
            this.showToast('Nombre del inventario es requerido', 'error');
            return;
        }

        const newInventory = {
            id: Date.now(),
            name,
            description,
            type,
            hosts: type === 'static' ? this.parseInventoryHosts(hosts) : {},
            created_at: new Date().toISOString()
        };

        this.inventories.push(newInventory);
        this.renderInventoriesList();
        this.populateInventorySelect();
        this.closeInventoryModal();
        this.showToast('Inventario creado', 'success');
    }

    parseInventoryHosts(hostsText) {
        try {
            // Intenta parsear como YAML
            return jsyaml.load(hostsText) || {};
        } catch (e) {
            try {
                // Intenta parsear como JSON
                return JSON.parse(hostsText) || {};
            } catch (e) {
                console.error('Error parsing inventory hosts:', e);
                return {};
            }
        }
    }

    populateInventorySelect() {
        const select = document.getElementById('inventory-select');
        if (!select) return;

        // Limpiar opciones existentes (excepto la primera)
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Agregar inventarios
        this.inventories.forEach(inv => {
            const option = document.createElement('option');
            option.value = inv.id;
            option.textContent = inv.name;
            select.appendChild(option);
        });
    }

    toggleCustomInventory() {
        const inventorySelect = document.getElementById('inventory-select');
        const inventoryContent = document.getElementById('inventory-content');
        
        if (inventoryContent.style.display === 'none') {
            inventoryContent.style.display = 'block';
            inventorySelect.style.display = 'none';
        } else {
            inventoryContent.style.display = 'none';
            inventorySelect.style.display = 'block';
        }
    }

    // Funciones de utilidad para templates
    loadTemplate(templateName) {
        const templates = {
            'basic-setup': `---
- name: Basic server setup
  hosts: all
  become: yes
  tasks:
    - name: Update package cache
      apt:
        update_cache: yes
        cache_valid_time: 3600

    - name: Install basic packages
      package:
        name:
          - curl
          - wget
          - git
          - unzip
        state: present

    - name: Create admin user
      user:
        name: admin
        groups: sudo
        append: yes
        shell: /bin/bash`,

            'web-server': `---
- name: Web server setup
  hosts: webservers
  become: yes
  tasks:
    - name: Install nginx
      package:
        name: nginx
        state: present

    - name: Start nginx service
      service:
        name: nginx
        state: started
        enabled: yes

    - name: Ensure web directory exists
      file:
        path: /var/www/html
        state: directory
        mode: '0755'

    - name: Deploy index.html
      copy:
        content: "<h1>Welcome to {{ inventory_hostname }}</h1>"
        dest: /var/www/html/index.html
        mode: '0644'`,

            'database': `---
- name: Database server setup
  hosts: databases
  become: yes
  tasks:
    - name: Install PostgreSQL
      package:
        name: postgresql
        state: present

    - name: Ensure PostgreSQL is running
      service:
        name: postgresql
        state: started
        enabled: yes

    - name: Create database user
      postgresql_user:
        name: myuser
        password: mypassword
        state: present

    - name: Create database
      postgresql_db:
        name: mydb
        owner: myuser
        state: present`
        };

        const content = templates[templateName];
        if (content) {
            document.getElementById('playbook-content').value = content;
            this.showToast(`Template "${templateName}" cargado`, 'success');
        }
    }

    // Funciones de usuario y preferencias
    loadUserPreferences() {
        const prefs = JSON.parse(localStorage.getItem('conductor_preferences') || '{}');
        
        // Aplicar tema
        if (prefs.theme) {
            document.documentElement.setAttribute('data-theme', prefs.theme);
        }
        
        // Aplicar estado del sidebar
        const sidebar = document.getElementById('sidebar');
        if (sidebar && prefs.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        }
    }

    saveUserPreferences() {
        const sidebar = document.getElementById('sidebar');
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        
        const prefs = {
            theme: theme,
            sidebarCollapsed: sidebar ? sidebar.classList.contains('collapsed') : false
        };
        
        localStorage.setItem('conductor_preferences', JSON.stringify(prefs));
    }

    initializeTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem('conductor_preferences') ? 
            JSON.parse(localStorage.getItem('conductor_preferences')).theme : null;
        
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        this.saveUserPreferences();
    }

    // Funciones de notificaciones
    loadNotifications() {
        const notificationsList = document.getElementById('notifications-list');
        if (!notificationsList) return;

        // Notificaciones de ejemplo
        const notifications = [
            {
                id: 1,
                title: 'Job completado',
                message: 'El job "Deploy Web Server" se completó exitosamente',
                time: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
                read: false,
                type: 'success'
            },
            {
                id: 2,
                title: 'Alerta del sistema',
                message: 'Uso de CPU por encima del 80%',
                time: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
                read: false,
                type: 'warning'
            },
            {
                id: 3,
                title: 'Job fallido',
                message: 'El job "Database Backup" falló durante la ejecución',
                time: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                read: true,
                type: 'error'
            }
        ];

        notificationsList.innerHTML = notifications.map(notif => `
            <div class="notification-item ${notif.read ? 'read' : 'unread'} ${notif.type}">
                <div class="notification-icon">
                    <i class="fas ${this.getNotificationIcon(notif.type)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notif.title}</div>
                    <div class="notification-message">${notif.message}</div>
                    <div class="notification-time">${this.formatTime(notif.time)}</div>
                </div>
                <button class="notification-action" onclick="conductor.markNotificationRead(${notif.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'warning': 'fa-exclamation-triangle',
            'error': 'fa-exclamation-circle',
            'info': 'fa-info-circle'
        };
        return icons[type] || 'fa-bell';
    }

    markNotificationRead(notificationId) {
        // Implementar lógica para marcar notificación como leída
        this.showToast('Notificación marcada como leída', 'success');
    }

    markAllRead() {
        // Implementar lógica para marcar todas las notificaciones como leídas
        this.showToast('Todas las notificaciones marcadas como leídas', 'success');
    }

    // Funciones de búsqueda global
    performGlobalSearch(query) {
        if (!query.trim()) return;

        // Buscar en jobs
        const jobResults = this.jobs.filter(job => 
            job.name.toLowerCase().includes(query.toLowerCase()) ||
            (job.output && job.output.toLowerCase().includes(query.toLowerCase()))
        );

        // Buscar en inventarios
        const inventoryResults = this.inventories.filter(inv => 
            inv.name.toLowerCase().includes(query.toLowerCase()) ||
            (inv.description && inv.description.toLowerCase().includes(query.toLowerCase()))
        );

        // Buscar en templates
        const templateResults = this.templates.filter(template => 
            template.name.toLowerCase().includes(query.toLowerCase()) ||
            (template.description && template.description.toLowerCase().includes(query.toLowerCase()))
        );

        // Mostrar resultados (podría implementarse un modal de resultados de búsqueda)
        const totalResults = jobResults.length + inventoryResults.length + templateResults.length;
        
        if (totalResults > 0) {
            this.showToast(`Encontrados ${totalResults} resultados para "${query}"`, 'info');
        } else {
            this.showToast(`No se encontraron resultados para "${query}"`, 'warning');
        }
    }

    // Funciones de utilidad para el editor
    formatYaml() {
        const editor = document.getElementById('playbook-content');
        if (!editor) return;

        try {
            const parsed = jsyaml.load(editor.value);
            const formatted = jsyaml.dump(parsed, { indent: 2 });
            editor.value = formatted;
            this.showToast('YAML formateado correctamente', 'success');
        } catch (error) {
            this.showToast('Error al formatear YAML: ' + error.message, 'error');
        }
    }

    fullscreenEditor() {
        const editor = document.getElementById('playbook-content');
        if (!editor) return;

        editor.classList.toggle('fullscreen');
        
        if (editor.classList.contains('fullscreen')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    // Actualizaciones periódicas
    startPeriodicUpdates() {
        // Actualizar dashboard cada 30 segundos
        this.dashboardInterval = setInterval(() => {
            if (this.currentSection === 'dashboard') {
                this.updateSystemMetrics(this.generateMockMetrics());
            }
        }, 30000);

        // Actualizar jobs cada 10 segundos
        this.jobsInterval = setInterval(() => {
            if (this.currentSection === 'jobs') {
                this.updateJobsStatus();
            }
        }, 10000);

        // Actualizar logs si auto-refresh está activado
        this.logsInterval = setInterval(() => {
            const autoRefresh = document.getElementById('auto-refresh-logs');
            if (this.currentSection === 'logs' && autoRefresh && autoRefresh.checked) {
                this.renderLogsList();
            }
        }, 5000);
    }

    updateJobsStatus() {
        // Simular cambios de estado en jobs
        this.jobs.forEach(job => {
            if (job.status === 'running') {
                // Simular progreso
                if (Math.random() > 0.8) {
                    job.status = 'completed';
                    job.completed_at = new Date().toISOString();
                    job.duration = `${Math.floor(Math.random() * 10) + 1}m ${Math.floor(Math.random() * 60)}s`;
                    job.output += '\n\nJob completado exitosamente';
                }
            }
        });

        this.renderJobsList();
        this.updateDashboardStats();
    }

    // Limpieza
    destroy() {
        // Limpiar event listeners
        this.eventHandlers.forEach((handler, element) => {
            if (element.removeEventListener) {
                element.removeEventListener('click', handler);
                element.removeEventListener('input', handler);
                element.removeEventListener('change', handler);
                element.removeEventListener('keydown', handler);
            }
        });

        // Limpiar intervals
        clearInterval(this.pollingInterval);
        clearInterval(this.dashboardInterval);
        clearInterval(this.jobsInterval);
        clearInterval(this.logsInterval);

        // Desconectar socket
        if (this.socket) {
            this.socket.disconnect();
        }

        console.log('🧹 Conductor App destruida');
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Ocultar pantalla de carga
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 1500);
    
    // Inicializar aplicación
    window.conductor = new ConductorApp();
    conductor.init();
});

// Funciones globales para uso en atributos onclick
function switchSection(section) {
    if (window.conductor) {
        window.conductor.switchSection(section);
    }
}

function refreshDashboard() {
    if (window.conductor) {
        window.conductor.refreshDashboard();
    }
}

function refreshJobs() {
    if (window.conductor) {
        window.conductor.refreshJobs();
    }
}

function quickJobModal() {
    if (window.conductor) {
        window.conductor.showQuickJobModal();
    }
}

function closeJobModal() {
    if (window.conductor) {
        window.conductor.closeJobModal();
    }
}

function closeInventoryModal() {
    if (window.conductor) {
        window.conductor.closeInventoryModal();
    }
}

function closeQuickJobModal() {
    if (window.conductor) {
        window.conductor.closeQuickJobModal();
    }
}

function toggleCustomInventory() {
    if (window.conductor) {
        window.conductor.toggleCustomInventory();
    }
}

function formatYaml() {
    if (window.conductor) {
        window.conductor.formatYaml();
    }
}

function fullscreenEditor() {
    if (window.conductor) {
        window.conductor.fullscreenEditor();
    }
}

function loadTemplate(templateName) {
    if (window.conductor) {
        window.conductor.loadTemplate(templateName);
    }
}

function showCreateInventoryModal() {
    if (window.conductor) {
        window.conductor.showCreateInventoryModal();
    }
}

// Service Worker registration for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}