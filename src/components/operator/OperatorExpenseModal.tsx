'use client'

// v373: Modal para editar gastos del operador — Extraído como componente independiente

interface OperatorExpenseModalProps {
  editingExpense: any
  expenseFormFields: any
  isSavingExpense: boolean
  onFieldChange: (fields: any) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export default function OperatorExpenseModal({ 
  editingExpense, 
  expenseFormFields, 
  isSavingExpense, 
  onFieldChange, 
  onSubmit, 
  onClose 
}: OperatorExpenseModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '25px' }}>
        <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Editar Gasto/Nota</h3>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="form-group">
            <label className="form-label">Monto ($)</label>
            <input type="number" step="0.01" className="form-input" value={expenseFormFields.amount} onChange={e => onFieldChange({...expenseFormFields, amount: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input type="text" className="form-input" value={expenseFormFields.description} onChange={e => onFieldChange({...expenseFormFields, description: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input type="date" className="form-input" value={expenseFormFields.date} onChange={e => onFieldChange({...expenseFormFields, date: e.target.value})} required />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" id="opIsNote" checked={expenseFormFields.isNote} onChange={e => onFieldChange({...expenseFormFields, isNote: e.target.checked})} />
            <label htmlFor="opIsNote">¿Es solo una nota?</label>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSavingExpense}>
              {isSavingExpense ? '...' : 'Actualizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
