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

export default function NuevoProyectoPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useLocalStorage('project_draft_step', 1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1: Datos Generales
  const [projectData, setProjectData, removeProjectData] = useLocalStorage('project_draft_data', {
    title: '',
    type: 'INSTALLATION',
    subtype: '',
    address: '',
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
    { id: 'OTHER', label: 'Otro' }
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

  const SPECS_BY_CONTRACT: any = {
    INSTALLATION: [
      { id: 'c_inst_desc', label: '¿Qué se va a instalar?', type: 'text', placeholder: 'Ej: Bomba calor hidropónica' },
      { id: 'c_inst_loc', label: 'Ubicación específica', type: 'text', placeholder: 'Ej: Terraza posterior' }
    ],
    MAINTENANCE: [
      { id: 'c_maint_freq', label: 'Frecuencia', type: 'select', options: ['Semanal', 'Quincenal', 'Mensual', 'Trimestral', 'Otro'] },
      { id: 'c_maint_last', label: 'Último mantenimiento', type: 'date' }
    ],
    REPAIR: [
      { id: 'c_rep_desc', label: 'Falla reportada', type: 'text', placeholder: 'Ej: Fuga en tubería 2"' },
      { id: 'c_rep_urg', label: 'Urgencia', type: 'select', options: ['Baja', 'Media', 'Crítica'] }
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
  const [clients, setClients] = useState<any[]>([])
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
  const [availableTeam, setAvailableTeam] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam, removeTeam] = useLocalStorage<string[]>('project_draft_team', [])

  // Step 6: Presupuesto
  const [budgetItems, setBudgetItems, removeBudgetItems] = useLocalStorage<BudgetItem[]>('project_draft_budget', [])
  const [materials, setMaterials] = useState<any[]>([])
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

  useEffect(() => {
    // Fetch clients
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setClients(data) })
      .catch(console.error)

    // Fetch operators and subcontratistas
    fetch('/api/users?roles=OPERATOR,SUBCONTRATISTA')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAvailableTeam(data) })
      .catch(console.error)
    // Fetch materials
    fetch('/api/materials')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setMaterials(data) })
      .catch(err => {
        console.error('Error fetching materials:', err)
        setMaterials([])
      })
  }, [])

  const handleNext = () => {
    // Step 1 validation
    if (step === 1 && (projectData.categoryList.length === 0 || projectData.contractTypeList.length === 0)) {
        return setError('Selecciona al menos una categoría y un tipo de contrato.')
    }
    
      // Step 2 validation - FLEXIBLE
      if (step === 2) {
        if (!clientData.name || clientData.name.trim().length < 3) {
          return setError('El nombre del cliente debe ser real (mínimo 3 caracteres).')
        }
      }
    
    // Step 3 validation - Audio/Transcription
    if (step === 3 && !projectData.technicalSpecs.description) {
      return setError('Debes incluir la descripción técnica (o transcripción del audio) del proyecto.')
    }

    if (step === 4 && phases.length === 0) return setError('Debes añadir al menos una fase.')
    if (step === 5 && selectedTeam.length === 0) return setError('Debes seleccionar al menos un integrante del equipo.')
    
    setError('')
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setError('')
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCreate = async () => {
    setLoading(true)
    setError('')

    try {
      const resp = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...projectData,
          subtype: projectData.type === 'OTHER' ? projectData.subtype : '',
          client: clientData,
          phases: phases,
          team: selectedTeam,
          budgetItems: budgetItems,
          categoryList: projectData.categoryList.map(c => c === 'OTRO' ? (projectData.otherCategory || 'OTRO') : c),
          contractTypeList: projectData.contractTypeList.map(c => c === 'OTHER' ? (projectData.otherContractType || 'OTHER') : c),
          technicalSpecs: projectData.technicalSpecs,
          specsAudioUrl: projectData.specsAudioUrl,
          specsTranscription: projectData.technicalSpecs.description,
          status: projectData.status,
          clientId: clientData.id,
          files: uploadedFiles
        })
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

      router.push(`/admin/proyectos/${newProj.id}`)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
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
    if (selectedTeam.includes(id)) {
      setSelectedTeam(selectedTeam.filter(t => t !== id))
    } else {
      setSelectedTeam([...selectedTeam, id])
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

  // Common UI styles
  const inputGroupStyle = { marginBottom: '20px' }
  const labelStyle = { display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }

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
      // Ensure specific mapped labels are used if needed by generator
    })

    if (preview && typeof result === 'string') {
      setPdfPreviewUrl(result)
      window.open(result, '_blank')
    }
  }

  return (
    <div className="p-6 new-project-page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="dashboard-header mb-6">
        <div>
          <h2>Crear Nuevo Proyecto</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Asistente de configuración paso a paso.</p>
        </div>
      </div>

      {/* Stepper Wizard Component */}
      <div className="card mb-6" style={{ padding: '0', overflow: 'hidden' }}>
        <style>{`.wizard-stepper::-webkit-scrollbar { display: none; } .wizard-stepper { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
        <div className="wizard-stepper" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-deep)', overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
          {[1, 2, 3, 4, 5, 6].map((num, idx) => (
            <div key={num} className="wizard-step" style={{
              flex: '1 0 auto', 
              minWidth: '85px',
              padding: '12px 10px', 
              textAlign: 'center', 
              borderBottom: step === num ? '3px solid var(--primary)' : '3px solid transparent',
              color: step === num ? 'var(--primary)' : (step > num ? 'var(--success)' : 'var(--text-muted)'),
              fontWeight: step === num ? 'bold' : 'normal',
              cursor: 'default',
              position: 'relative'
            }}>
              <div style={{ fontSize: '0.85rem' }}>{num}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                {num === 1 ? 'General' : num === 2 ? 'Cliente' : num === 3 ? 'Especific.' : num === 4 ? 'Fases' : num === 5 ? 'Equipo' : 'Presup.'}
              </div>
              {idx < 5 && <div style={{ position: 'absolute', right: 0, top: '20%', height: '60%', width: '1px', backgroundColor: 'var(--border-color)' }} />}
            </div>
          ))}
        </div>

        <div className="wizard-content" style={{ padding: '20px' }}>
          {error && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in">
              <div className="responsive-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '30px' }}>
                <div>
                    <div style={{ ...inputGroupStyle, marginBottom: '25px' }}>
                        <label style={labelStyle}>Etapa del Proyecto *</label>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <div 
                                onClick={() => setProjectData({...projectData, status: 'LEAD'})}
                                style={{ 
                                    flex: 1, padding: '12px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                                    border: projectData.status === 'LEAD' ? '2px solid var(--warning)' : '2px solid var(--border)',
                                    backgroundColor: projectData.status === 'LEAD' ? 'rgba(234, 179, 8, 0.1)' : 'var(--bg-deep)',
                                    color: projectData.status === 'LEAD' ? 'var(--warning)' : 'var(--text-muted)',
                                    fontWeight: projectData.status === 'LEAD' ? 'bold' : 'normal', transition: 'all 0.2s'
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'block', margin: '0 auto 5px' }}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                Lead / Negociando
                            </div>
                            <div 
                                onClick={() => setProjectData({...projectData, status: 'ACTIVO'})}
                                style={{ 
                                    flex: 1, padding: '12px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                                    border: projectData.status === 'ACTIVO' ? '2px solid var(--success)' : '2px solid var(--border)',
                                    backgroundColor: projectData.status === 'ACTIVO' ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-deep)',
                                    color: projectData.status === 'ACTIVO' ? 'var(--success)' : 'var(--text-muted)',
                                    fontWeight: projectData.status === 'ACTIVO' ? 'bold' : 'normal', transition: 'all 0.2s'
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'block', margin: '0 auto 5px' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                Activo / Aprobado
                            </div>
                        </div>
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Título del Proyecto (o referencia del Lead) *</label>
                        <input type="text" className="form-input" placeholder="Ej. Piscina Residencial Familia Ruiz" value={projectData.title} onChange={e => setProjectData({...projectData, title: e.target.value})} autoFocus />
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Tipo de Proyecto *</label>
                        <select 
                            className="form-input" 
                            value={projectData.type} 
                            onChange={e => setProjectData({...projectData, type: e.target.value})}
                        >
                            <option value="INSTALLATION">Instalación Nueva</option>
                            <option value="MAINTENANCE">Mantenimiento</option>
                            <option value="REPAIR">Reparación</option>
                            <option value="OTHER">Otro</option>
                        </select>
                    </div>

                    {projectData.type === 'OTHER' && (
                        <div style={inputGroupStyle} className="animate-fade-in">
                            <label style={labelStyle}>Especificar otro tipo de proyecto *</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Ej. Remodelación" 
                                value={projectData.subtype} 
                                onChange={e => setProjectData({...projectData, subtype: e.target.value})} 
                            />
                        </div>
                    )}

                    <div className="responsive-2col-equal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Fecha de Inicio Prevista</label>
                            <input type="date" className="form-input" value={projectData.startDate} onChange={e => setProjectData({...projectData, startDate: e.target.value})} />
                        </div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Ciudad</label>
                            <input type="text" className="form-input" placeholder="Ej. Loja" value={projectData.city} onChange={e => setProjectData({...projectData, city: e.target.value})} />
                        </div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Dirección Física (Opcional)</label>
                            <input type="text" className="form-input" placeholder="Ej. Calle 123" value={projectData.address} onChange={e => setProjectData({...projectData, address: e.target.value})} />
                        </div>
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Tipo de Contrato (Multiselección) *</label>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                            {CONTRACT_TYPES.map(ct => {
                                const isSelected = projectData.contractTypeList.includes(ct.id)
                                return (
                                    <div 
                                        key={ct.id} 
                                        onClick={() => toggleContractType(ct.id)}
                                        style={{ 
                                            padding: '8px 16px', 
                                            borderRadius: '20px', 
                                            border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)', 
                                            backgroundColor: isSelected ? 'var(--primary-glow)' : 'var(--bg-deep)',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {ct.label}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {projectData.contractTypeList.includes('OTHER') && (
                        <div style={{ ...inputGroupStyle, marginTop: '15px' }} className="animate-fade-in">
                            <label style={labelStyle}>Especificar otro tipo de contrato *</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Ej: Asesoría Técnica" 
                                value={projectData.otherContractType} 
                                onChange={e => setProjectData({...projectData, otherContractType: e.target.value})} 
                            />
                        </div>
                    )}
                </div>

                <div>
                    <label style={labelStyle}>Categorías del Proyecto (Puedes marcar varias) *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                        {CATEGORIES.map(cat => {
                            const isSelected = projectData.categoryList.includes(cat.id)
                            return (
                                <div 
                                    key={cat.id} 
                                    onClick={() => toggleCategory(cat.id)}
                                    style={{ 
                                        padding: '12px', 
                                        borderRadius: '8px', 
                                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)', 
                                        backgroundColor: isSelected ? 'var(--primary-glow)' : 'var(--bg-deep)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: isSelected ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6L9 17l-5-5"/></svg>}
                                    </div>
                                    <span style={{ fontSize: '0.85rem', color: isSelected ? 'var(--text)' : 'var(--text-muted)' }}>{cat.label}</span>
                                </div>
                            )
                        })}
                    </div>
                    {projectData.categoryList.includes('OTRO') && (
                        <div style={{ ...inputGroupStyle, marginTop: '15px' }} className="animate-fade-in">
                            <label style={labelStyle}>Especificar otra categoría *</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Ej: Sauna, Fuente Decorativa, etc." 
                                value={projectData.otherCategory} 
                                onChange={e => setProjectData({...projectData, otherCategory: e.target.value})} 
                            />
                        </div>
                    )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h3 style={{ marginBottom: '20px', color: 'var(--text)' }}>Información del Cliente</h3>
              
              <div style={{ ...inputGroupStyle, display: 'flex', gap: '15px', alignItems: 'flex-end', zIndex: 50, position: 'relative' }}>
                <div style={{ flex: 1, position: 'relative' }} ref={clientDropdownRef}>
                  <label style={labelStyle}>¿Cliente Existente o Nuevo?</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Buscar cliente por nombre..." 
                    value={clientSearchText}
                    onChange={(e) => {
                      setClientSearchText(e.target.value)
                      setShowClientDropdown(true)
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    // Delay hiding to allow click on option
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                  />
                  {showClientDropdown && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '5px', maxHeight: '250px', overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                      <div 
                        style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'var(--primary)', fontWeight: 'bold' }}
                        onClick={() => selectExistingClient('NEW')}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        + Añadir Nuevo Cliente
                      </div>
                      {filteredClients.map(c => (
                        <div 
                          key={c.id} 
                          style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}
                          onClick={() => selectExistingClient(c.id)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--primary)';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--text)';
                          }}
                        >
                          {c.name}
                        </div>
                      ))}
                      {filteredClients.length === 0 && (
                        <div style={{ padding: '12px', color: 'var(--text-muted)' }}>No se encontraron clientes...</div>
                      )}
                    </div>
                  )}
                </div>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', fontWeight: 'bold' }}
                  onClick={() => {
                    setIsNewClient(true)
                    setClientData({
                      id: null,
                      name: 'CONSUMIDOR FINAL',
                      ruc: '9999999999999',
                      phone: '0000000000',
                      email: 'ventas@aquatech.com',
                      city: 'LOJA',
                      address: 'S/N',
                      notes: 'Venta rápida / CF'
                    })
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  Opción CF
                </button>
              </div>

              <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-deep)' }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Nombre/Razón Social *</label>
                  <input type="text" className="form-input" placeholder="Juan Pérez" value={clientData.name} onChange={e => setClientData({...clientData, name: e.target.value})} disabled={!isNewClient} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>R.U.C / C.I. *</label>
                    <input type="text" className="form-input" placeholder="1105XXXXXX001" value={clientData.ruc} onChange={e => setClientData({...clientData, ruc: e.target.value})} disabled={!isNewClient} />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Teléfono *</label>
                    <input type="tel" className="form-input" placeholder="+593..." value={clientData.phone} onChange={e => setClientData({...clientData, phone: e.target.value})} disabled={!isNewClient} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Ciudad *</label>
                    <input type="text" className="form-input" placeholder="Loja" value={clientData.city} onChange={e => setClientData({...clientData, city: e.target.value})} disabled={!isNewClient} />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Email *</label>
                    <input type="email" className="form-input" placeholder="correo@ejemplo.com" value={clientData.email} onChange={e => setClientData({...clientData, email: e.target.value})} disabled={!isNewClient} />
                  </div>
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Dirección Física *</label>
                  <input type="text" className="form-input" placeholder="Ciudad, Barrio, Calle Principal y Secundaria" value={clientData.address} onChange={e => setClientData({...clientData, address: e.target.value})} disabled={!isNewClient} />
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Notas adicionales</label>
                  <textarea className="form-input" rows={2} placeholder="Cliente preferencial, facturación especial, etc." value={clientData.notes} onChange={e => setClientData({...clientData, notes: e.target.value})} disabled={!isNewClient} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h3 style={{ marginBottom: '10px', color: 'var(--text)' }}>Especificaciones Técnicas</h3>
              
              {/* Audio/Video Spec Section */}
              <div className="mb-8">
                <div className="responsive-2col-equal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div className="card-shadow-hover" style={{ backgroundColor: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                      Instrucciones por Voz
                    </h4>
                    <MediaCapture 
                      mode="audio" 
                      onCapture={async (blob, type, text) => {
                        setProjectData(prev => ({
                          ...prev,
                          technicalSpecs: { ...prev.technicalSpecs, description: (prev.technicalSpecs.description || '') + ' ' + text }
                        }))
                        
                        // Upload audio to gallery
                        const formData = new FormData()
                        formData.append('file', blob, 'nota_de_voz.webm')
                        try {
                          const res = await fetch('/api/upload', { method: 'POST', body: formData })
                          if (res.ok) {
                            const data = await res.json()
                            setUploadedFiles(prev => [...prev, data])
                          }
                        } catch (err) { console.error('Audio upload failed', err) }
                      }}
                    />
                  </div>
                  
                  <div className="card-shadow-hover" style={{ backgroundColor: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
                      Grabación de Video (Especif.)
                    </h4>
                    <MediaCapture 
                      mode="video" 
                      onCapture={async (blob, type, text) => {
                        setProjectData(prev => ({
                          ...prev,
                          technicalSpecs: { ...prev.technicalSpecs, description: (prev.technicalSpecs.description || '') + ' ' + text }
                        }))
                        
                        // Upload video to gallery
                        const formData = new FormData()
                        formData.append('file', blob, 'especificacion_tecnica.webm')
                        try {
                          const res = await fetch('/api/upload', { method: 'POST', body: formData })
                          if (res.ok) {
                            const data = await res.json()
                            setUploadedFiles(prev => [...prev, data])
                          }
                        } catch (err) { console.error('Video upload failed', err) }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Descripción Detallada / Sugerencia de Audio *</label>
                <textarea 
                  className="form-input" 
                  rows={4} 
                  placeholder="Explica a detalle el proyecto o transcribe el audio aquí..." 
                  value={projectData.technicalSpecs.description || ''} 
                  onChange={e => updateSpec('description', e.target.value)}
                />
              </div>

            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: 'var(--text)' }}>Fases de Trabajo Estimadas</h3>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                        Total Estimado: {totalEstimatedDays} días
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={addPhase}>+ Añadir Fase</button>
                </div>
              </div>
              
              <p style={{ color: 'var(--text)', opacity: 0.9, backgroundColor: 'var(--bg-surface)', padding: '10px 15px', borderRadius: '8px', borderLeft: '4px solid var(--primary)', marginBottom: '20px', fontSize: '0.95rem' }}>
                Las fases organizan el trabajo en campo y permiten estructurar la bitácora de los operadores. Podrás añadir más después.
              </p>

              {phases.map((phase, index) => (
                <div key={phase.id} style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '20px', padding: '15px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', position: 'relative', border: '1px solid var(--border)' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="text" className="form-input mb-3" placeholder="Título de Fase (Ej. Excavación y Drenaje)" value={phase.title} onChange={e => updatePhase(index, 'title', e.target.value)} />
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }} className="mb-3">
                        <textarea className="form-input" rows={2} placeholder="Descripción teórica de los trabajos a realizar..." value={phase.description} onChange={e => updatePhase(index, 'description', e.target.value)} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, width: '130px', margin: '0 auto' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 'bold' }}>Grabar Evidencia:</div>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                <MediaCapture 
                                    mode="audio" 
                                    compact={true}
                                    onCapture={async (blob, type, text) => {
                                        updatePhase(index, 'description', (phase.description || '') + ' ' + text)
                                        
                                        // Upload audio for this phase to the project gallery
                                        const formData = new FormData()
                                        formData.append('file', blob, `fase_${index + 1}_audio.webm`)
                                        try {
                                          const res = await fetch('/api/upload', { method: 'POST', body: formData })
                                          if (res.ok) {
                                            const data = await res.json()
                                            setUploadedFiles(prev => [...prev, data])
                                          }
                                        } catch (err) { console.error('Phase audio upload failed', err) }
                                    }}
                                />
                              </div>
                              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                <MediaCapture 
                                    mode="video"
                                    compact={true}
                                    onCapture={async (blob, type, text) => {
                                        updatePhase(index, 'description', (phase.description || '') + ' ' + text)
                                        
                                        // Upload video for this phase to the project gallery
                                        const formData = new FormData()
                                        formData.append('file', blob, `fase_${index + 1}_video.webm`)
                                        try {
                                          const res = await fetch('/api/upload', { method: 'POST', body: formData })
                                          if (res.ok) {
                                            const data = await res.json()
                                            setUploadedFiles(prev => [...prev, data])
                                          }
                                        } catch (err) { console.error('Fase Video upload failed', err) }
                                    }}
                                />
                              </div>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Días estimados para esta fase:</label>
                        <input 
                            type="number" 
                            className="form-input" 
                            style={{ width: '80px' }} 
                            value={phase.estimatedDays} 
                            onChange={e => updatePhase(index, 'estimatedDays', e.target.value)} 
                        />
                    </div>
                  </div>
                  {phases.length > 1 && (
                    <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)', padding: '5px' }} onClick={() => removePhase(index)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="animate-fade-in">
              <h3 style={{ marginBottom: '20px', color: 'var(--text)' }}>Asignar Equipo Operativo</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Selecciona los operadores que estarán asignados a este proyecto en campo.</p>
              
              {availableTeam.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                  {availableTeam.map(operator => {
                    const isSelected = selectedTeam.includes(operator.id)
                    return (
                      <div 
                        key={operator.id}
                        onClick={() => toggleTeamMember(operator.id)}
                        style={{ 
                          padding: '15px', 
                          border: isSelected ? '2px solid var(--primary)' : '2px solid var(--border-color)', 
                          borderRadius: '8px',
                          backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.05)' : 'var(--bg-surface)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '15px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', color: 'var(--primary)', fontWeight: 'bold' }}>
                          {operator.name.substring(0,2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: 0, color: 'var(--text)' }}>{operator.name}</h4>
                          <span style={{ fontSize: '0.8rem', color: operator.activeProjectsCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                            {operator.activeProjectsCount} Proyectos Activos
                          </span>
                        </div>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: isSelected ? 'none' : '2px solid var(--border-color)', backgroundColor: isSelected ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  No hay operadores disponibles o activos en el sistema.
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="animate-fade-in" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, color: 'var(--text)' }}>Presupuesto Estimado</h3>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)' }}>$ {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>

              <div style={{ padding: '12px 15px', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--primary)', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/></svg>
                <div style={{ color: 'var(--text)', minWidth: 0 }}>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '0.95rem', color: 'var(--primary)' }}>Presupuesto Profesional</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>Agrega materiales del catálogo o servicios globales.</p>
                </div>
              </div>

              <BudgetBuilder 
                initialItems={budgetItems}
                materials={materials}
                onItemsChange={handleBudgetChange}
                showPreviewActions={true}
                onGeneratePDF={(preview) => generatePDF(preview)}
              />

              {/* Notas del presupuesto - visible en todos los dispositivos */}
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Notas / Observaciones del Presupuesto</label>
                <textarea 
                  className="form-input" 
                  rows={3} 
                  placeholder="Notas adicionales que aparecerán en el documento PDF del presupuesto..." 
                  value={projectData.technicalSpecs.description || ''} 
                  onChange={e => updateSpec('description', e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Unified Project Uploader (Shows in all steps) */}
        <div style={{ padding: '0 20px 20px 20px' }}>
          <ProjectUploader 
            files={uploadedFiles} 
            onAddFile={(file) => setUploadedFiles(prev => [...prev, file])}
            onRemoveFile={(url) => setUploadedFiles(prev => prev.filter(f => f.url !== url))}
            title="Planos y Archivos Iniciales (Galería)"
          />
        </div>

        {/* Action Buttons */}
        <div style={{ padding: '15px 20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          {step > 1 ? (
            <button type="button" className="btn btn-ghost" onClick={() => { setError(''); setStep(s => s - 1) }} disabled={loading}>
              &larr; Volver
            </button>
          ) : (
            <Link href="/admin/proyectos" className="btn btn-ghost">Cancelar</Link>
          )}

          {step < 10 ? (
             step < 6 ? (
               <button type="button" className="btn btn-primary" onClick={handleNext}>Continuar &rarr;</button>
             ) : (
               <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                 {loading ? 'Creando...' : 'Crear Proyecto Completado'}
               </button>
             )
          ) : null}
        </div>
      </div>

      {/* Responsive styles for mobile */}
      <style jsx>{`
        @media (max-width: 768px) {
          .new-project-page {
            padding: 8px !important;
          }
          .wizard-content {
            padding: 12px !important;
          }
          .responsive-2col,
          .responsive-2col-equal {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .form-input {
            padding: 8px 10px !important;
            font-size: 0.85rem !important;
          }
          .btn {
            padding: 8px 16px !important;
            font-size: 0.8rem !important;
          }
          .wizard-steps {
            gap: 8px !important;
            padding: 8px !important;
          }
          h3 { font-size: 1.1rem !important; }
          h4 { font-size: 0.9rem !important; }
        }
        .wizard-stepper::-webkit-scrollbar {
          display: none;
        }
        .wizard-stepper {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
