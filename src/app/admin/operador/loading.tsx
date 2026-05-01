export default function Loading() {
  return (
    <div className="container" style={{ paddingTop: '20px' }}>
      {/* Título Skeleton */}
      <div className="skeleton" style={{ height: '30px', width: '200px', marginBottom: '20px', borderRadius: '6px' }}></div>
      
      {/* Tabs Skeleton */}
      <div className="card" style={{ padding: '10px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <div className="skeleton" style={{ height: '40px', flex: 1, borderRadius: '8px' }}></div>
        <div className="skeleton" style={{ height: '40px', flex: 1, borderRadius: '8px' }}></div>
        <div className="skeleton" style={{ height: '40px', flex: 1, borderRadius: '8px' }}></div>
      </div>
      
      {/* Grid de Proyectos Skeleton */}
      <div className="grid-responsive">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="card" style={{ height: '160px', display: 'flex', flexDirection: 'column' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
               <div className="skeleton" style={{ height: '24px', width: '40%', borderRadius: '12px' }}></div>
               <div className="skeleton" style={{ height: '14px', width: '20%', borderRadius: '4px' }}></div>
             </div>
             <div className="skeleton" style={{ height: '24px', width: '80%', marginBottom: '10px', borderRadius: '6px' }}></div>
             <div className="skeleton" style={{ height: '14px', width: '50%', marginBottom: '20px', borderRadius: '4px' }}></div>
             
             <div style={{ marginTop: 'auto' }}>
               <div className="skeleton" style={{ height: '6px', width: '100%', borderRadius: '3px' }}></div>
             </div>
          </div>
        ))}
      </div>
    </div>
  )
}
