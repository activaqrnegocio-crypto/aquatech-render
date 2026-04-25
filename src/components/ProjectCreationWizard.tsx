'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import ProjectUploader, { ProjectFile } from '@/components/ProjectUploader'
import MediaCapture from '@/components/MediaCapture'
import BudgetBuilder, { BudgetItem } from '@/components/BudgetBuilder'
import { generateProfessionalPDF } from '@/lib/pdf-generator'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { PROJECT_TYPES, translateType, PROJECT_CATEGORIES, translateCategory } from '@/lib/constants'
import { db } from '@/lib/db'
import dynamic from 'next/dynamic'

const CameraCapture = dynamic(() => import('@/components/camera/CameraCapture'), { ssr: false })

interface ProjectCreationWizardProps {
  panelBase?: string; // e.g. "/admin/proyectos" or "/admin/operador"
}

export default function ProjectCreationWizard({ panelBase = '/admin/proyectos' }: ProjectCreationWizardProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)
  const [step, setStep] = useLocalStorage('project_draft_step', 1)
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const isCreatingRef = useRef(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])
  const [error, setError] = useState('')

  // Step 1: Datos Generales
  const [projectData, setProjectData, removeProjectData] = useLocalStorage('project_draft_data', {
    title: '',
    type: 'INSTALLATION',
    subtype: '',
    address: '',
    locationLink: '',
    city: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    categoryList: [] as string[],
    otherCategory: '',
    contractTypeList: [] as string[],
    otherContractType: '',
    technicalSpecs: {} as any,
    specsAudioUrl: '',
    status: 'LEAD'
  })

  const CONTRACT_TYPES = [
    { id: 'INSTALLATION', label: 'Instalación Nueva' },
    { id: 'MAINTENANCE', label: 'Mantenimiento' },
    { id: 'REPAIR', label: 'Reparación' },
    { id: 'OTRO', label: 'Otro' }
  ]

  const CATEGORIES = [
    { id: 'PISCINA', label: 'Piscina' },
    { id: 'JACUZZI', label: 'Jacuzzi' },
    { id: 'BOMBAS', label: 'Sistema de Bombeo' },
    { id: 'TRATAMIENTO', label: 'Tratamiento de Agua' },
    { id: 'RIEGO', label: 'Sistema de Riego' },
    { id: 'CALENTAMIENTO', label: 'Calentamiento' },
    { id: 'CONTRA_INCENDIOS', label: 'Contra Incendios' },
    { id: 'MANTENIMIENTO', label: 'Mantenimiento General' },
    { id: 'OTRO', label: 'Otros' }
  ]

  const SPECS_BY_CATEGORY: any = {
    PISCINA: [
      { id: 'p_dim', label: 'Dimensiones (L x A)', type: 'text', placeholder: 'Ej: 8m x 4m' },
      { id: 'p_vol', label: 'Volumen (Galones)', type: 'number', placeholder: '15000' },
      { id: 'p_acabado', label: 'Tipo de Acabado', type: 'select', options: ['Diamond Brite', 'Azulejo', 'Pintura', 'Liner'] }
    ],
    JACUZZI: [
      { id: 'j_jets', label: 'Número de Jets', type: 'number', placeholder: '6' },
      { id: 'j_calor', label: 'Sistema de Calor', type: 'select', options: ['Gas', 'Bomba de Calor', 'Eléctrico'] }
    ],
    BOMBAS: [
      { id: 'b_potencia', label: 'Potencia (HP)', type: 'text', placeholder: '1.5 HP' },
      { id: 'b_voltaje', label: 'Voltaje', type: 'select', options: ['110V', '220V', 'Trifásico'] },
      { id: 'b_caudal', label: 'Caudal (GPM)', type: 'number', placeholder: '60' }
    ],
    RIEGO: [
      { id: 'r_area', label: 'Área m2', type: 'number', placeholder: '200' },
      { id: 'r_zonas', label: 'Número de Zonas', type: 'number', placeholder: '4' }
    ],
    TRATAMIENTO: [
      { id: 't_filtro', label: 'Tipo de Filtro', type: 'select', options: ['Arena', 'Cartucho', 'Ablandador'] },
      { id: 't_caudal', label: 'Caudal requerido', type: 'text', placeholder: '5 GPM' }
    ]
  }

  // Step 2: Cliente
  const [isNewClient, setIsNewClient] = useLocalStorage('project_draft_is_new_client', true)
  const [clientData, setClientData, removeClientData] = useLocalStorage('project_draft_client', {
    id: null as string | null,
    name: '',
    ruc: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    notes: ''
  })
  const [clients, setClients] = useLocalStorage<any[]>('project_draft_available_clients', [])
  const [clientSearchText, setClientSearchText] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Step 3: Fases
  const [phases, setPhases, removePhases] = useLocalStorage<any[]>('project_draft_phases', [
    { id: '1', title: 'Fases Inicial / Planificación', description: '', estimatedDays: 5 }
  ])

  // Step 4: Equipo
  const [availableTeam, setAvailableTeam] = useLocalStorage<any[]>('project_draft_available_team', [])
  const [selectedTeam, setSelectedTeam, removeTeam] = useLocalStorage<string[]>('project_draft_team', [])

  const [offlineUser, setOfflineUser] = useState<any>(null)
  useEffect(() => {
    if (status === 'unauthenticated' || (!session && status !== 'loading')) {
      db.auth.get('last_session').then(u => {
        if (u) setOfflineUser(u)
      }).catch(() => {})
    }
  }, [session, status])

  // Auto-add operator to team if not already there
  useEffect(() => {
    const activeUserId = session?.user?.id || offlineUser?.id;
    const activeUserRole = (session?.user as any)?.role || offlineUser?.role;
    
    if (activeUserId && !selectedTeam.includes(String(activeUserId))) {
      if (activeUserRole === 'OPERATOR' || activeUserRole === 'OPERADOR') {
         setSelectedTeam(prev => [...prev, String(activeUserId)])
      }
    }
  }, [session?.user?.id, offlineUser?.id])

  // Step 6: Presupuesto
  const [budgetItems, setBudgetItems, removeBudgetItems] = useLocalStorage<BudgetItem[]>('project_draft_budget', [])
  const [materials, setMaterials] = useLocalStorage<any[]>('project_draft_available_materials', [])
  const [budgetCalculations, setBudgetCalculations] = useState<any>({
    subtotal: 0,
    subtotal0: 0,
    subtotal15: 0,
    ivaAmount: 0,
    grandTotal: 0
  })

  const handleBudgetChange = useCallback((newItems: BudgetItem[], newCalculations: any) => {
    setBudgetItems(newItems)
    setBudgetCalculations(newCalculations)
  }, [])

  // Step 6+: Files (Persistent)
  const [uploadedFiles, setUploadedFiles, removeFiles] = useLocalStorage<ProjectFile[]>('project_draft_files', [])
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [showGallery, setShowGallery] = useState(false)
  const [showCameraCapture, setShowCameraCapture] = useState(false)

  const fetchTeam = useCallback(() => {
    if (status !== 'authenticated') return;
    
    // Use ONLY roles that exist in the Prisma enum to avoid 500 errors
    fetch('/api/users?roles=OPERATOR,SUBCONTRATISTA')
      .then(r => r.json())
      .then(data => { 
        if (Array.isArray(data)) {
          const filtered = data.filter(u => 
            u.role === 'OPERATOR' || 
            u.role === 'OPERADOR' || 
            u.role === 'SUBCONTRATISTA'
          )
          setAvailableTeam(filtered)
        }
      })
      .catch(console.error)
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return;

    // Fetch clients
    const loadClients = async () => {
      try {
        const r = await fetch('/api/clients')
        if (r.ok) {
          const data = await r.json()
          if (Array.isArray(data)) {
            setClients(data)
            await db.clientsCache.clear()
            await db.clientsCache.bulkPut(data)
          }
        }
      } catch (e) {
        const cached = await db.clientsCache.toArray()
        if (cached.length > 0) setClients(cached)
      }
    }

    // Fetch materials
    const loadMaterials = async () => {
      try {
        const r = await fetch('/api/materials')
        if (r.ok) {
          const data = await r.json()
          if (Array.isArray(data)) {
            setMaterials(data)
            await db.materialsCache.clear()
            await db.materialsCache.bulkPut(data)
          }
        }
      } catch (e) {
        const cached = await db.materialsCache.toArray()
        if (cached.length > 0) setMaterials(cached)
      }
    }

    loadClients()
    loadMaterials()
    fetchTeam()
  }, [status, fetchTeam])

  const handleNext = () => {
    if (step === 1) {
      if (!projectData.title || projectData.title.trim().length < 2) {
        return setError('El nombre del proyecto es obligatorio.')
      }
      if (!clientData.name || clientData.name.trim().length < 2) {
        return setError('El nombre del cliente es obligatorio.')
      }
    }
    
    setError('')
    if (step < 3) setStep(s => s + 1)
  }

  const handleBack = () => {
    setError('')
    if (step > 1) setStep(s => s - 1)
  }

  const handleGetGPS = async () => {
    setGpsLoading(true)
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización')
      setGpsLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords
      const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`
      setProjectData({ ...projectData, locationLink: mapsUrl })
      setGpsLoading(false)
    }, (err) => {
      console.error(err)
      alert('No se pudo obtener la ubicación')
      setGpsLoading(false)
    })
  }

  const handleCreate = async () => {
    if (isCreatingRef.current) return
    if (!projectData.title) return setError('Falta el nombre del proyecto.')
    
    // Auto-fill budget if empty to pass validation
    const finalBudgetItems = budgetItems.length > 0 ? budgetItems : [{
      name: 'Levantamiento Técnico / Inspección',
      quantity: 1,
      estimatedCost: 0,
      unit: 'GLOBAL',
      isTaxed: false
    }]
    
    isCreatingRef.current = true
    setLoading(true)
    setError('')

    const payload = {
      ...projectData,
      subtype: projectData.type === 'OTHER' ? projectData.subtype : '',
      client: clientData,
      phases: phases.length > 0 ? phases : [{ title: 'Fase Inicial', description: 'Levantamiento general', estimatedDays: 1 }],
      team: selectedTeam.length > 0 ? selectedTeam : [String(session?.user?.id || offlineUser?.id)],
      budgetItems: finalBudgetItems,
      categoryList: projectData.categoryList.map(c => c === 'OTRO' ? (projectData.otherCategory || 'OTRO') : c),
      contractTypeList: projectData.contractTypeList.map(c => c === 'OTHER' ? (projectData.otherContractType || 'OTHER') : c),
      technicalSpecs: { ...projectData.technicalSpecs, locationLink: projectData.locationLink },
      specsAudioUrl: projectData.specsAudioUrl,
      specsTranscription: projectData.technicalSpecs.description,
      status: projectData.status,
      clientId: clientData.id,
      files: uploadedFiles
    }

    try {
      if (!navigator.onLine) {
        await db.outbox.add({
          type: 'PROJECT',
          projectId: 0,
          payload: payload,
          timestamp: Date.now(),
          status: 'pending'
        })
        
        // Clear local draft data after successful outbox add
        setStep(1)
        removeProjectData()
        removeClientData()
        removePhases()
        removeTeam()
        removeBudgetItems()
        removeFiles()
        window.localStorage.removeItem('project_draft_is_new_client')
        
        alert('Estás sin conexión. El proyecto se ha guardado localmente y se sincronizará cuando vuelvas a tener internet.')
        router.push(panelBase)
        return
      }

      const resp = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || 'Error al crear proyecto')
      }

      const newProj = await resp.json()
      
      // Cleanup localStorage
      setStep(1)
      removeProjectData()
      removeClientData()
      removePhases()
      removeTeam()
      removeBudgetItems()
      removeFiles()
      window.localStorage.removeItem('project_draft_is_new_client')

      // Redirect to the appropriate detail view
      if (panelBase.includes('operador')) {
        router.push(`/admin/operador/proyecto/${newProj.id}`)
      } else {
        router.push(`/admin/proyectos/${newProj.id}`)
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
      isCreatingRef.current = false
    }
  }

  const addPhase = () => {
    const newId = (phases.length + 1).toString()
    setPhases([...phases, { id: newId, title: `Fase ${newId}: Nueva Fase`, description: '', estimatedDays: 0 }])
  }

  const removePhase = (index: number) => {
    const newPhases = [...phases]
    newPhases.splice(index, 1)
    setPhases(newPhases)
  }

  const updatePhase = (index: number, field: string, value: any) => {
    const newPhases = [...phases]
    newPhases[index] = { ...newPhases[index], [field]: value }
    setPhases(newPhases)
  }

  const totalEstimatedDays = phases.reduce((acc, p) => acc + (Number(p.estimatedDays) || 0), 0)

  const toggleCategory = (catId: string) => {
    const current = projectData.categoryList
    if (current.includes(catId)) {
      setProjectData({ ...projectData, categoryList: current.filter(c => c !== catId) })
    } else {
      setProjectData({ ...projectData, categoryList: [...current, catId] })
    }
  }

  const toggleContractType = (typeId: string) => {
    const current = projectData.contractTypeList
    if (current.includes(typeId)) {
      setProjectData({ ...projectData, contractTypeList: current.filter(t => t !== typeId) })
    } else {
      setProjectData({ ...projectData, contractTypeList: [...current, typeId] })
    }
  }

  const updateSpec = (specId: string, value: any) => {
    setProjectData({
      ...projectData,
      technicalSpecs: { ...projectData.technicalSpecs, [specId]: value }
    })
  }

  const toggleTeamMember = (id: string) => {
    if (selectedTeam.includes(String(id))) {
      setSelectedTeam(selectedTeam.filter(t => t !== String(id)))
    } else {
      setSelectedTeam([...selectedTeam, String(id)])
    }
  }

  const selectAllTeam = () => {
    if (availableTeam.length > 0) {
      setSelectedTeam(availableTeam.map(t => String(t.id)))
    }
  }

  const selectExistingClient = (id: string) => {
    if (id === 'NEW') {
      setIsNewClient(true)
      setClientData({ id: null, name: '', ruc: '', phone: '', email: '', city: '', address: '', notes: '' })
      setClientSearchText('+ Añadir Nuevo Cliente')
    } else {
      const c = clients.find(c => c.id === id)
      if (c) {
        setIsNewClient(false)
        setClientData({
          id: c.id,
          name: c.name,
          ruc: c.ruc || '',
          phone: c.phone || '',
          email: c.email || '',
          city: c.city || '',
          address: c.address || '',
          notes: c.notes || ''
        })
        setClientSearchText(c.name)
      }
    }
    setShowClientDropdown(false)
  }

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearchText.toLowerCase())).slice(0, 10)

  // Total amount used in PDF generation
  const { subtotal0, subtotal15, ivaAmount, grandTotal, totalBudget } = budgetCalculations

  const generatePDF = (preview = false) => {
    const info = {
      name: clientData.name || 'Cliente Particular',
      ruc: clientData.ruc || '9999999999',
      address: clientData.address || 'N/A',
      phone: clientData.phone || 'N/A',
      email: clientData.email || 'N/A'
    }
    const items = budgetItems.map((bi: any) => ({
      name: bi.name,
      quantity: bi.unit === 'GLOBAL' ? 'GLOBAL' : bi.quantity,
      unit: bi.unit || 'UND',
      estimatedCost: Number(bi.estimatedCost)
    }))

    const totalsObj = {
      subtotal: totalBudget,
      subtotal0: subtotal0,
      subtotal15: subtotal15,
      discountTotal: 0,
      ivaAmount: ivaAmount,
      totalAmount: grandTotal
    }

    const result = generateProfessionalPDF(info, items, totalsObj, {
      docType: 'PRESUPUESTO',
      docId: preview ? 'VISTA-PREVIA' : `PRJ-${Date.now().toString().slice(-4)}`,
      notes: projectData.technicalSpecs?.description || 'DOCUMENTO PRELIMINAR',
      action: preview ? 'preview' : 'save',
      sellerName: session?.user?.name || 'Aquatech',
    })

    if (preview && typeof result === 'string') {
      setPdfPreviewUrl(result)
      window.open(result, '_blank')
    }
  }

  if (!isMounted) return <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>;

  const steps_config = [
    { id: 1, title: 'Datos Proyecto y Cliente', icon: '📋' },
    { id: 2, title: 'Equipo Asignado', icon: '👥' },
    { id: 3, title: 'Multimedia / Levantamiento', icon: '📸' },
  ]

  return (
    <div className="new-project-page" style={{ 
      padding: '20px', 
      maxWidth: '1000px', 
      margin: '0 auto', 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '25px', 
      position: 'relative', 
      overflowX: 'hidden', 
      boxSizing: 'border-box',
      paddingBottom: '120px' 
    }}>
      <div className="dashboard-header mb-8">
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Nuevo Proyecto</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Configuración centralizada en un solo lugar.</p>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '15px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }} className="animate-fade-in">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
          {error}
        </div>
      )}

      <div className="accordion-container" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {steps_config.map((s) => (
          <div key={s.id} style={{ 
            marginBottom: '15px', 
            border: step === s.id ? '2px solid var(--primary)' : '1px solid var(--border)', 
            borderRadius: '16px', 
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            transition: 'all 0.3s ease'
          }}>
            {/* Accordion Header */}
            <div 
              onClick={() => setStep(step === s.id ? 0 : s.id)}
              style={{ 
                padding: '20px 25px', cursor: 'pointer', display: 'flex', alignItems: 'center', 
                justifyContent: 'space-between', backgroundColor: step === s.id ? 'rgba(56, 189, 248, 0.05)' : 'transparent',
                borderBottom: step === s.id ? '1px solid var(--border)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ 
                  width: '32px', height: '32px', borderRadius: '8px', backgroundColor: step === s.id ? 'var(--primary)' : 'var(--bg-deep)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: step === s.id ? 'white' : 'var(--text-muted)',
                  fontWeight: 'bold', fontSize: '1rem'
                }}>{s.id}</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: step === s.id ? 'var(--text)' : 'var(--text-muted)' }}>{s.title}</span>
              </div>
              <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>{step === s.id ? '−' : '+'}</span>
            </div>

            {/* Accordion Content */}
            {step === s.id && (
              <div className="animate-slide-down" style={{ padding: '25px' }}>
                {s.id === 1 && (
                  <div className="animate-fade-in step-content">
                     {/* Seccion datos generales */}
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="responsive-2col">
                        <div>
                           <label className="form-label">Título del Proyecto *</label>
                           <input type="text" className="form-input" placeholder="Ej. Piscina Residencial Familia Ruiz" value={projectData.title || ''} onChange={e => setProjectData({...projectData, title: e.target.value})} />
                        </div>
                        <div>
                           <label className="form-label">Etapa del Proyecto</label>
                           <select className="form-input" value={projectData.status} onChange={e => setProjectData({...projectData, status: e.target.value})}>
                              <option value="LEAD">Lead / Negociando</option>
                              <option value="ACTIVO">Activo / Aprobado</option>
                           </select>
                        </div>
                     </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }} className="responsive-2col">
                        <div>
                           <label className="form-label">Tipo de Proyecto</label>
                           <select className="form-input" value={projectData.type} onChange={e => setProjectData({...projectData, type: e.target.value})}>
                              <option value="INSTALLATION">Instalación Nueva</option>
                              <option value="MAINTENANCE">Mantenimiento</option>
                              <option value="REPAIR">Reparación</option>
                              <option value="OTRO">Otro</option>
                           </select>
                           {projectData.type === 'OTRO' && (
                              <input 
                                type="text" className="form-input mt-2" placeholder="Especificar tipo..." 
                                value={projectData.subtype || ''} 
                                onChange={e => setProjectData({...projectData, subtype: e.target.value})}
                              />
                           )}
                        </div>
                        <div>
                           <label className="form-label">Fecha Proyectada</label>
                           <input type="date" className="form-input" value={projectData.startDate || ''} onChange={e => setProjectData({...projectData, startDate: e.target.value})} />
                        </div>
                        <div>
                           <label className="form-label">Ciudad</label>
                           <input type="text" className="form-input" placeholder="Ciudad" value={projectData.city || ''} onChange={e => setProjectData({...projectData, city: e.target.value})} />
                        </div>
                     </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                           <div style={{ flex: 1 }}>
                              <label className="form-label">Ubicación GPS / Google Maps</label>
                              <input 
                                 type="text" 
                                 className="form-input" 
                                 placeholder="El enlace se generará al presionar el botón 📍 GPS" 
                                 value={projectData.locationLink || ''} 
                                 onChange={e => {
                                    setProjectData({
                                      ...projectData,
                                      locationLink: e.target.value,
                                      technicalSpecs: {
                                        ...projectData.technicalSpecs,
                                        locationLink: e.target.value
                                      }
                                    });
                                 }} 
                              />
                           </div>
                           <button 
                             type="button" 
                             onClick={handleGetGPS}
                             disabled={gpsLoading}
                             className="btn btn-secondary"
                             style={{ 
                               height: '38px', 
                               display: 'flex', 
                               alignItems: 'center', 
                               gap: '6px',
                               fontSize: '0.85rem',
                               padding: '0 20px',
                               fontWeight: '600'
                             }}
                           >
                             {gpsLoading ? 'Obteniendo...' : '📍 GPS'}
                           </button>
                        </div>
                      </div>
                     <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '15px 0' }} />

                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, color: 'var(--primary)' }}>Información del Cliente</h4>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setClientData({ ...clientData, name: 'CONSUMIDOR FINAL', ruc: '9999999999999', phone: '0999999999', email: 'cf@aquatech.com.ec' })}>
                           🚀 Consumidor Final
                        </button>
                     </div>

                     {/* Client search removed per user request */}

                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }} className="responsive-2col">
                        <input type="text" className="form-input" placeholder="Nombre completo *" value={clientData.name} onChange={e => setClientData({...clientData, name: e.target.value})} disabled={!isNewClient} />
                        <input type="text" className="form-input" placeholder="RUC / Cédula" value={clientData.ruc} onChange={e => setClientData({...clientData, ruc: e.target.value})} disabled={!isNewClient} />
                        <input type="tel" className="form-input" placeholder="Teléfono *" value={clientData.phone} onChange={e => setClientData({...clientData, phone: e.target.value})} disabled={!isNewClient} />
                        <input type="email" className="form-input" placeholder="Email" value={clientData.email} onChange={e => setClientData({...clientData, email: e.target.value})} disabled={!isNewClient} />
                     </div>
                  </div>
                )}

                {s.id === 2 && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)' }}>Asignar Equipo</h3>
                       {availableTeam.length > 0 && (
                          <button 
                            type="button" 
                            onClick={selectAllTeam}
                            className="btn btn-ghost btn-xs"
                            style={{ 
                              fontSize: '0.8rem', 
                              color: 'var(--primary)',
                              padding: '4px 10px',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              borderRadius: '8px'
                            }}
                          >
                            ✓ Seleccionar Todos
                          </button>
                       )}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '-10px' }}>Selecciona los operadores o subcontratistas para este proyecto.</p>
                    
                    <div className="team-grid">
                       {availableTeam.map(t => (
                         <div 
                           key={t.id} 
                           onClick={() => toggleTeamMember(t.id)}
                           className={`team-card ${selectedTeam.includes(String(t.id)) ? 'selected' : ''}`}
                           style={{
                             border: selectedTeam.includes(String(t.id)) ? '2px solid var(--primary)' : '1px solid var(--border)',
                             backgroundColor: selectedTeam.includes(String(t.id)) ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-deep)',
                           }}
                         >
                            <div 
                              className="team-avatar"
                              style={{
                                backgroundColor: selectedTeam.includes(String(t.id)) ? 'var(--primary)' : 'var(--bg-card)',
                              }}
                            >
                               {t.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                               <div className="team-name" style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text)' }}>{t.name}</div>
                               <div className="team-role" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.role}</div>
                            </div>
                         </div>
                       ))}
                       {availableTeam.length === 0 && (
                          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                             No hay operadores disponibles.
                          </div>
                       )}
                    </div>
                  </div>
                )}

                {s.id === 3 && (
                  <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }} className="media-capture-row">
                       <label className="form-label" style={{ margin: 0 }}>Descripción Técnica y Multimedia</label>
                       <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <MediaCapture 
                            mode="audio" 
                            compact 
                            onCapture={async (blob, type, text) => {
                              try {
                                const isOnline = navigator.onLine;
                                let url = '';
                                let filename = `specs-audio-${Date.now()}.webm`;

                                if (isOnline) {
                                  const { uploadToBunnyClientSide } = await import('@/lib/storage-client');
                                  const result = await uploadToBunnyClientSide(blob, filename, 'projects');
                                  url = result.url;
                                  filename = result.filename;
                                } else {
                                  url = await new Promise((resolve) => {
                                    const reader = new FileReader();
                                    reader.onload = () => resolve(reader.result as string);
                                    reader.readAsDataURL(blob);
                                  });
                                }

                                setProjectData(prev => ({ ...prev, specsAudioUrl: isOnline ? url : '' }));
                                
                                // Also add to gallery as MASTER
                                const fileObj: any = {
                                  id: `audio-${Date.now()}`,
                                  name: filename,
                                  type: 'AUDIO',
                                  url: url,
                                  size: blob.size,
                                  category: 'MASTER',
                                  mimeType: 'audio/webm'
                                }
                                setUploadedFiles(prev => [...prev, fileObj]);
                                updateSpec('description', (projectData.technicalSpecs.description || '') + ' ' + text);
                              } catch (err) {
                                console.error('Error handling specs audio:', err);
                                updateSpec('description', (projectData.technicalSpecs.description || '') + ' ' + text);
                              }
                            }} 
                          />
                          <button 
                             type="button"
                             onClick={() => setShowCameraCapture(true)} 
                             className="btn btn-secondary" 
                             style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 15px', borderRadius: '16px' }}
                          >
                             📸 Cámara (Foto/Video)
                          </button>
                          <button 
                             type="button"
                             onClick={() => setShowGallery(true)} 
                             className="btn btn-primary" 
                             style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 15px', borderRadius: '16px' }}
                          >
                             🖼️ Galería
                          </button>
                       </div>
                    </div>
                    <textarea className="form-input mb-6" rows={3} placeholder="Describe el alcance técnico o usa los botones de voz/video..." value={projectData.technicalSpecs.description || ''} onChange={e => updateSpec('description', e.target.value)} />
                    
                    {showCameraCapture && (
                      <div className="animate-slide-down" style={{ marginBottom: '25px', padding: '20px', backgroundColor: 'var(--bg-deep)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                         <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.1rem', textAlign: 'center' }}>Cámara Integrada</h3>
                         <CameraCapture 
                                       onPhotoCapture={async (blob) => {
                               try {
                                  setShowCameraCapture(false)
                                  const isOnline = navigator.onLine;
                                  let url = '';
                                  let filename = `Foto-${Date.now()}.jpg`;

                                  if (isOnline) {
                                    const { uploadToBunnyClientSide } = await import('@/lib/storage-client')
                                    const result = await uploadToBunnyClientSide(blob, filename, 'projects')
                                    url = result.url;
                                    filename = result.filename;
                                  } else {
                                    url = await new Promise((resolve) => {
                                      const reader = new FileReader();
                                      reader.onload = () => resolve(reader.result as string);
                                      reader.readAsDataURL(blob);
                                    });
                                  }

                                  const fileObj: any = {
                                     id: `capture-${Date.now()}`,
                                     name: filename,
                                     type: 'IMAGE',
                                     url: url,
                                     size: blob.size,
                                     category: 'MASTER',
                                     mimeType: 'image/jpeg'
                                  }
                                  setUploadedFiles(prev => [...prev, fileObj])
                               } catch (err) {
                                  console.error('Error handling photo:', err)
                                  alert('Error al procesar foto')
                               }
                            }}
                            onVideoCapture={async (blob) => {
                               try {
                                  setShowCameraCapture(false)
                                  const isOnline = navigator.onLine;
                                  let url = '';
                                  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
                                  let filename = `Video-${Date.now()}.${ext}`;

                                  if (isOnline) {
                                    const { uploadToBunnyClientSide } = await import('@/lib/storage-client')
                                    const result = await uploadToBunnyClientSide(blob, filename, 'projects')
                                    url = result.url;
                                    filename = result.filename;
                                  } else {
                                    url = await new Promise((resolve) => {
                                      const reader = new FileReader();
                                      reader.onload = () => resolve(reader.result as string);
                                      reader.readAsDataURL(blob);
                                    });
                                  }

                                  const fileObj: any = {
                                     id: `capture-${Date.now()}`,
                                     name: filename,
                                     type: 'VIDEO',
                                     url: url,
                                     size: blob.size,
                                     category: 'MASTER',
                                     mimeType: blob.type
                                  }
                                  setUploadedFiles(prev => [...prev, fileObj])
                               } catch (err) {
                                  console.error('Error handling video:', err)
                                  alert('Error al procesar video')
                               }
                            }}
                            onClose={() => setShowCameraCapture(false)}
                         />
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation inside accordion */}
                 <div style={{ display: 'flex', gap: '10px', marginTop: '25px', justifyContent: 'flex-end' }}>
                   {step === 1 || step === 2 ? (
                      <button type="button" className="btn btn-primary" onClick={handleNext}>Siguiente &rarr;</button>
                   ) : (
                      <>
                        <button type="button" className="btn btn-ghost" onClick={handleBack}>&larr; Volver</button>
                        <button 
                          type="button" 
                          className="btn btn-primary" 
                          onClick={handleCreate} 
                          disabled={loading}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          {loading ? (
                            <>
                              <div className="loading-spinner" style={{ width: '16px', height: '16px', borderTopColor: 'white' }} />
                              {navigator.onLine ? 'Creando...' : 'Guardando...'}
                            </>
                          ) : 'Finalizar Proyecto'}
                        </button>
                      </>
                   )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Floating Gallery Button hidden by request
      <button 
        type="button"
        onClick={() => setShowGallery(true)}
        style={{
          position: 'fixed',
          bottom: '100px',
          right: '25px',
          width: '65px',
          height: '65px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px var(--primary-glow)',
          border: '2px solid rgba(255,255,255,0.2)',
          zIndex: 100,
          cursor: 'pointer'
        }}
        className="pulse-animation"
        title="Planos y Diseño (Galería)"
      >
        <div style={{ fontSize: '2rem' }}>🖼️</div>
      </button>
      */}

      {showGallery && (
         <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', width: '100%', maxWidth: '800px', maxHeight: '90vh', borderRadius: '24px', position: 'relative', overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
               <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Planos y Diseño</h2>
                  <button onClick={() => setShowGallery(false)} className="btn btn-ghost btn-sm">Cerrar</button>
               </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                  <ProjectUploader
                    hideCaptureButtons={true}
                    files={uploadedFiles}
                    onAddFile={(newFile) => setUploadedFiles(prev => [...prev, newFile])}
                    onRemoveFile={(url) => setUploadedFiles(prev => prev.filter(f => f.url !== url))}
                    defaultCategory="MASTER"
                  />
                </div>
            </div>
         </div>
      )}

      <style jsx>{`
        .pulse-animation { animation: pulse 2s infinite; }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .form-label { display: block; margin-bottom: 8px; color: var(--text-muted); font-weight: 600; font-size: 0.85rem; }
        
        .team-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }
        .team-card {
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .team-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1rem;
          color: white;
        }
        .step-content {
          display: grid;
          grid-template-columns: 1fr;
          gap: 30px;
        }

        @media (max-width: 768px) {
          .new-project-page { padding: 10px 5px !important; }
          .dashboard-header { margin-bottom: 15px !important; }
          .dashboard-header h2 { font-size: 1.4rem !important; }
          .accordion-container { gap: 10px !important; }
          .step-content { gap: 15px !important; }
          .responsive-2col { grid-template-columns: 1fr !important; gap: 10px !important; }
          .form-input { font-size: 16px !important; padding: 8px 12px !important; } /* Evita zoom en iOS */
          .btn { width: 100%; justify-content: center; padding: 10px !important; }
          .media-capture-row { flex-direction: column; align-items: stretch !important; gap: 10px !important; }
          .form-label { margin-bottom: 4px; font-size: 0.8rem; }
          
          .team-grid {
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 8px;
          }
          .team-card {
            padding: 8px;
            gap: 8px;
          }
          .team-avatar {
            width: 28px;
            height: 28px;
            font-size: 0.8rem;
          }
          .team-name {
            font-size: 0.8rem !important;
          }
          .team-role {
            font-size: 0.65rem !important;
          }
        }
      `}</style>
    </div>
  )
}
