'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import ProjectUploader, { ProjectFile } from '@/components/ProjectUploader'
import MediaCapture from '@/components/MediaCapture'
import { generateProfessionalPDF } from '@/lib/pdf-generator'

export default function NuevoProyectoPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1: Datos Generales
  const [projectData, setProjectData] = useState({
    title: '',
    type: 'INSTALLATION',
    address: '',
    city: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    categoryList: [] as string[],
    otherCategory: '',
    contractTypeList: [] as string[],
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
  const [isNewClient, setIsNewClient] = useState(true)
  const [clientData, setClientData] = useState({
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

  // Step 3: Fases
  const [phases, setPhases] = useState<any[]>([
    { id: '1', title: 'Fas e Inicial / Planificación', description: '', estimatedDays: 5 }
  ])

  // Step 4: Equipo
  const [availableTeam, setAvailableTeam] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string[]>([])

  // Step 5: Presupuesto
  const [budgetItems, setBudgetItems] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [searchMaterial, setSearchMaterial] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customQty, setCustomQty] = useState(1)
  const [globalDescription, setGlobalDescription] = useState('')
  const [globalPrice, setGlobalPrice] = useState('')
  const [customIsTaxed, setCustomIsTaxed] = useState(true)
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null)

  // Step 6+: Files (Persistent)
  const [uploadedFiles, setUploadedFiles] = useState<ProjectFile[]>([])
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setClients(data) })
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
    
    if (step === 4 && phases.length === 0) return setError('Debes añadir al menos una fase.')
    
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
          client: clientData,
          phases: phases,
          team: selectedTeam,
          budgetItems: budgetItems,
          categoryList: projectData.categoryList.map(c => c === 'OTRO' ? (projectData.otherCategory || 'OTRO') : c),
          contractTypeList: projectData.contractTypeList,
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

      router.push(`/admin/operador`)
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

  const addBudgetItem = (m: any) => {
    setCustomDescription(m.name)
    setCustomPrice(m.unitPrice.toString())
    setCustomQty(1)
    setSelectedInventoryId(m.id)
    setSearchMaterial('')
    // Focus the custom description input for better UX (optional)
  }

  const addCustomBudgetItem = (isGlobal = false) => {
    const newItem = {
      materialId: isGlobal ? null : selectedInventoryId,
      name: isGlobal ? globalDescription : customDescription,
      quantity: isGlobal ? 'GLOBAL' : Number(customQty),
      unit: isGlobal ? 'GLOBAL' : 'UND',
      estimatedCost: Number(isGlobal ? globalPrice : customPrice),
      isTaxed: customIsTaxed
    }
    setBudgetItems([...budgetItems, newItem])
    if (isGlobal) {
      setGlobalDescription('')
      setGlobalPrice('')
    } else {
      setCustomDescription('')
      setCustomPrice('')
      setCustomQty(1)
      setSelectedInventoryId(null)
    }
  }

  const removeBudgetItem = (index: number) => {
    const newItems = [...budgetItems]
    newItems.splice(index, 1)
    setBudgetItems(newItems)
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

  const filteredMaterials = searchMaterial.trim() === '' ? [] : materials.filter(m => 
    m.name.toLowerCase().includes(searchMaterial.toLowerCase()) || 
    m.category?.toLowerCase().includes(searchMaterial.toLowerCase())
  ).slice(0, 5)

  // Calculate detailed totals for project
  const { subtotal0, subtotal15, totalBudget } = budgetItems.reduce((acc, item) => {
    const qty = item.quantity === 'GLOBAL' ? 1 : Number(item.quantity)
    const lineTotal = qty * Number(item.estimatedCost)
    
    if (item.isTaxed === false) {
      acc.subtotal0 += lineTotal
    } else {
      acc.subtotal15 += lineTotal
    }
    acc.totalBudget += lineTotal
    return acc
  }, { subtotal0: 0, subtotal15: 0, totalBudget: 0 })
  
  const ivaAmount = subtotal15 * 0.15
  const grandTotal = subtotal0 + subtotal15 + ivaAmount

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
      sellerName: session?.user?.name || 'Aquatech'
    })

    if (preview) {
      if (typeof result === 'string') {
        setPdfPreviewUrl(result)
      } else {
        alert("No se pudo generar la vista previa. Intenta actualizar los datos.")
      }
    }
  }

  return (
    <div className="p-6" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="dashboard-header mb-6">
        <div>
          <h2>Crear Nuevo Proyecto</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Asistente de configuración paso a paso.</p>
        </div>
      </div>

      {/* Stepper Wizard Component */}
      <div className="card mb-6" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-deep)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {[1, 2, 3, 4, 5].map((num, idx) => (
            <div key={num} style={{
              flex: '1 0 auto', 
              minWidth: '100px',
              padding: '15px', 
              textAlign: 'center', 
              borderBottom: step === num ? '3px solid var(--primary)' : '3px solid transparent',
              color: step === num ? 'var(--primary)' : (step > num ? 'var(--success)' : 'var(--text-muted)'),
              fontWeight: step === num ? 'bold' : 'normal',
              cursor: 'default',
              position: 'relative'
            }}>
              <div>Paso {num}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                {num === 1 ? 'General' : num === 2 ? 'Cliente' : num === 3 ? 'Especific.' : num === 4 ? 'Fases' : 'Presupuesto'}
              </div>
              {idx < 4 && <div style={{ position: 'absolute', right: 0, top: '20%', height: '60%', width: '1px', backgroundColor: 'var(--border-color)' }} />}
            </div>
          ))}
        </div>

        <div style={{ padding: '30px' }}>
          {error && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                <div>
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
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
                </div>

                <div>
                    <label style={labelStyle}>Categorías del Proyecto (Puedes marcar varias) *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '10px' }}>
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
              
              <div style={{ ...inputGroupStyle, display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <label style={labelStyle}>¿Cliente Existente o Nuevo?</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="🔍 Buscar cliente existente..." 
                      value={clientSearchText}
                      onChange={(e) => {
                        setClientSearchText(e.target.value)
                        setShowClientDropdown(true)
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                    />
                    {showClientDropdown && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '100%', 
                        left: 0, 
                        right: 0, 
                        zIndex: 1000, 
                        backgroundColor: 'var(--bg-card)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '8px', 
                        marginTop: '5px', 
                        boxShadow: 'var(--shadow-lg)',
                        maxHeight: '250px',
                        overflowY: 'auto'
                      }}>
                        <div 
                          onClick={() => selectExistingClient('NEW')}
                          style={{ padding: '12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold' }}
                        >
                          + Crear Nuevo Cliente
                        </div>
                        {filteredClients.map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => selectExistingClient(c.id)}
                            style={{ 
                              padding: '12px', 
                              borderBottom: '1px solid var(--border)', 
                              cursor: 'pointer',
                              color: 'var(--text)'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-glow)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {c.name}
                          </div>
                        ))}
                        {filteredClients.length === 0 && clientSearchText !== '+ Añadir Nuevo Cliente' && (
                          <div style={{ padding: '12px', color: 'var(--text-muted)' }}>No se encontraron clientes</div>
                        )}
                      </div>
                    )}
                  </div>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>R.U.C / C.I. *</label>
                    <input type="text" className="form-input" placeholder="1105XXXXXX001" value={clientData.ruc} onChange={e => setClientData({...clientData, ruc: e.target.value})} disabled={!isNewClient} />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Teléfono *</label>
                    <input type="tel" className="form-input" placeholder="+593..." value={clientData.phone} onChange={e => setClientData({...clientData, phone: e.target.value})} disabled={!isNewClient} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
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
                        formData.append('file', blob, 'especificacion_tecnica_audio.webm')
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
              
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Las fases organizan el trabajo en campo y permiten estructurar la bitácora de los operadores. Podrás añadir más después.</p>

              {phases.map((phase, index) => (
                <div key={phase.id} style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '20px', padding: '15px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', position: 'relative', border: '1px solid var(--border)' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="text" className="form-input mb-3" placeholder="Título de Fase (Ej. Excavación y Drenaje)" value={phase.title} onChange={e => updatePhase(index, 'title', e.target.value)} />
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }} className="mb-3">
                        <textarea className="form-input" style={{ flex: '1 1 200px' }} rows={2} placeholder="Descripción teórica de los trabajos a realizar..." value={phase.description} onChange={e => updatePhase(index, 'description', e.target.value)} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, width: '130px', margin: '0 auto' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 'bold' }}>Grabar Evidencia:</div>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                <MediaCapture 
                                    mode="audio" 
                                    compact={true}
                                    onCapture={async (blob, type, text) => {
                                        updatePhase(index, 'description', (phase.description ? phase.description + '\n' : '') + '[Audio]: ' + text)
                                        
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
                                        updatePhase(index, 'description', (phase.description ? phase.description + '\n' : '') + '[Video]: ' + text)
                                        // Auto-upload the video for this phase to the project gallery
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
            <div className="animate-fade-in" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: 'var(--text)' }}>Presupuesto Estimado</h3>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)' }}>$ {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>

              <div style={{ padding: '15px', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--primary)', borderRadius: '8px', marginBottom: '25px', display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/></svg>
                <div style={{ color: 'var(--text)' }}>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: 'var(--primary)' }}>Generación de Presupuesto Profesional</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>Agrega materiales del inventario o partidas personalizadas. Los ítems del catálogo pueden ser <strong>editados en cantidad y precio</strong> antes de añadirlos. Todo se desglosará con el **IVA 15%** en el documento final.</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }} className="responsive-grid">
                <div>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '15px', color: 'var(--text-secondary)' }}>Añadir Materiales o Servicios</h4>
                  
                  {/* Buscador de Catálogo */}
                  <div style={{ ...inputGroupStyle, position: 'relative' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Buscar en catálogo..." 
                      value={searchMaterial} 
                      onChange={e => setSearchMaterial(e.target.value)} 
                    />
                    {filteredMaterials.length > 0 && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '100%', 
                        left: 0, 
                        right: 0, 
                        zIndex: 1000, 
                        backgroundColor: 'var(--bg-card)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '8px', 
                        marginTop: '5px', 
                        boxShadow: 'var(--shadow-lg)',
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {filteredMaterials.map(m => (
                          <div 
                            key={m.id} 
                            onClick={() => addBudgetItem(m)} 
                            style={{ padding: '12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} 
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-glow)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div style={{ fontWeight: '600', color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{m.name}</span>
                              <span style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>Seleccionar &rarr;</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>$ {m.unitPrice} - {m.category}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Custom specific materials (UND) */}
                  <div id="material-edit-box" style={{ padding: '20px', border: selectedInventoryId ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: '12px', backgroundColor: 'var(--bg-card)', marginBottom: '15px', position: 'relative' }}>
                    {selectedInventoryId && (
                      <div style={{ position: 'absolute', top: '-12px', left: '20px', backgroundColor: 'var(--primary)', color: 'var(--bg-deep)', padding: '2px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        CONFIGURANDO MATERIAL DEL CATÁLOGO
                      </div>
                    )}
                    
                    <label style={{ ...labelStyle, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', paddingBottom: '5px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Detalles del Ítem</span>
                      {selectedInventoryId && (
                         <button type="button" onClick={() => { setSelectedInventoryId(null); setCustomDescription(''); setCustomPrice(''); }} style={{ color: 'var(--danger)', background: 'none', border: 'none', fontSize: '0.7rem', cursor: 'pointer' }}>Cancelar</button>
                      )}
                    </label>

                    <div style={inputGroupStyle}>
                      <label style={labelStyle}>Descripción</label>
                      <input type="text" className="form-input" value={customDescription} onChange={e => setCustomDescription(e.target.value)} placeholder="Ej: Válvula de bola 2 pulgadas" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={customIsTaxed} onChange={e => setCustomIsTaxed(e.target.checked)} className="form-checkbox" />
                        <span className="text-sm">Aplica IVA 15%</span>
                      </label>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div style={inputGroupStyle}>
                        <label style={labelStyle}>Precio Unitario ($)</label>
                        <input type="number" className="form-input" value={customPrice} onChange={e => setCustomPrice(e.target.value)} placeholder="0.00" />
                      </div>
                      <div style={inputGroupStyle}>
                        <label style={labelStyle}>Cantidad (UND)</label>
                        <input type="number" className="form-input" value={customQty} onChange={e => setCustomQty(Number(e.target.value))} />
                      </div>
                    </div>
                    <button type="button" className={`btn ${selectedInventoryId ? 'btn-primary' : 'btn-secondary'} btn-sm btn-full`} onClick={() => addCustomBudgetItem(false)} disabled={!customDescription || !customPrice}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '6px', display: 'inline-block'}}><path d="M12 5v14M5 12h14"/></svg>
                      {selectedInventoryId ? 'Confirmar e Incluir al Presupuesto' : 'Añadir Material Extra'}
                    </button>
                  </div>
                  
                  {/* Global items (Servicios) */}
                  <div style={{ padding: '20px', border: '1px solid var(--primary)', borderRadius: '12px', backgroundColor: 'var(--primary-glow)' }}>
                    <label style={{ ...labelStyle, color: 'var(--primary)', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '5px', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '8px'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      Añadir Servicio / Ítem GLOBAL
                    </label>
                    <div style={inputGroupStyle}>
                      <label style={labelStyle}>Descripción del Servicio GLOBAL *</label>
                      <input type="text" className="form-input" value={globalDescription} onChange={e => setGlobalDescription(e.target.value)} placeholder="Ej: Construcción de Piscina 9M x 3M" />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Precio Unitario ($) *</label>
                        <input type="number" className="form-input" value={globalPrice} onChange={e => setGlobalPrice(e.target.value)} placeholder="0.00" />
                    </div>
                    <button type="button" className="btn btn-primary btn-sm btn-full" onClick={() => { addCustomBudgetItem(true); setPdfPreviewUrl(null); }} disabled={!globalDescription || !globalPrice}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '6px', display: 'inline-block'}}><path d="M12 5v14M5 12h14"/></svg>
                      Añadir a Presupuesto
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>Resumen del Presupuesto</h4>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th style={{ backgroundColor: 'var(--bg-deep)', width: '50px' }}>ITEM</th>
                            <th style={{ backgroundColor: 'var(--bg-deep)' }}>DESCRIPCION</th>
                            <th style={{ backgroundColor: 'var(--bg-deep)', textAlign: 'center' }}>CANTIDAD</th>
                            <th style={{ backgroundColor: 'var(--bg-deep)', textAlign: 'right' }}>P/UNITARIO</th>
                            <th style={{ backgroundColor: 'var(--bg-deep)', textAlign: 'right' }}>TOTAL</th>
                            <th style={{ backgroundColor: 'var(--bg-deep)', width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {budgetItems.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay items en el presupuesto</td></tr>
                          ) : (
                            budgetItems.map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ fontSize: '0.75rem', textAlign: 'center' }}>{idx + 1}</td>
                                <td style={{ fontSize: '0.85rem', fontWeight: '500', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '250px' }}>{item.name}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>{item.unit || 'UND'}</span>
                                  {item.quantity === 'GLOBAL' ? 'GLOBAL' : Number(item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>$ {Number(item.estimatedCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>$ {((item.quantity === 'GLOBAL' ? 1 : Number(item.quantity)) * item.estimatedCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <button type="button" onClick={() => removeBudgetItem(idx)} style={{ color: 'var(--danger)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px' }}>&times;</button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {budgetItems.length > 0 && (
                          <tfoot style={{ backgroundColor: 'var(--bg-deep)' }}>
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.85rem', padding: '10px' }}>SUBTOTAL TARIFA 0%</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem' }}>$ {subtotal0.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td></td>
                            </tr>
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.85rem', padding: '10px' }}>SUBTOTAL TARIFA 15%</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem' }}>$ {subtotal15.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td></td>
                            </tr>
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.85rem', padding: '10px' }}>IVA 15%</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem' }}>$ {ivaAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td></td>
                            </tr>
                            <tr style={{ backgroundColor: 'var(--primary-glow)' }}>
                              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1rem', padding: '14px', color: 'var(--primary)' }}>TOTAL A PAGAR (IVA 15% INCLUIDO)</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--primary)' }}>$ {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* Summary Actions */}
                  {budgetItems.length > 0 && (
                    <div style={{ padding: '15px 0', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={() => generatePDF(true)}
                        style={{ flex: 1 }}
                      >
                        Actualizar Vista Previa
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-primary btn-sm"
                        onClick={() => generatePDF(false)}
                        style={{ flex: 1 }}
                      >
                        PDF Oficial
                      </button>
                    </div>
                  )}

                  {/* PDF Preview Iframe Section */}
                  {pdfPreviewUrl && (
                    <div className="animate-fade-in" style={{ marginTop: '25px', padding: '10px', border: '1px solid var(--primary)', borderRadius: '12px', backgroundColor: 'var(--bg-deep)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>VISTA PREVIA REAL</h4>
                        <button type="button" onClick={() => setPdfPreviewUrl(null)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>Cerrar</button>
                      </div>
                      <iframe 
                        src={pdfPreviewUrl} 
                        style={{ width: '100%', height: '500px', border: 'none', borderRadius: '8px', backgroundColor: 'white' }} 
                        title="PDF Preview"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Unified Project Uploader (Shows in all steps) */}
        <div style={{ padding: '0 30px 30px 30px' }}>
          <ProjectUploader 
            files={uploadedFiles} 
            onAddFile={(file) => setUploadedFiles(prev => [...prev, file])}
            onRemoveFile={(url) => setUploadedFiles(prev => prev.filter(f => f.url !== url))}
            title="Planos y Archivos Iniciales (Galería)"
          />
        </div>

        {/* Action Buttons */}
        <div style={{ padding: '20px 30px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          {step > 1 ? (
            <button type="button" className="btn btn-ghost" onClick={() => { setError(''); setStep(s => s - 1) }} disabled={loading}>
              &larr; Volver
            </button>
          ) : (
            <Link href="/admin/operador" className="btn btn-ghost">Cancelar</Link>
          )}

          {step <= 5 ? (
             step < 5 ? (
               <button type="button" className="btn btn-primary" onClick={handleNext}>Continuar &rarr;</button>
             ) : (
               <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                 {loading ? 'Creando...' : 'Crear Proyecto Completado'}
               </button>
             )
          ) : null}
        </div>
      </div>
    </div>
  )
}
