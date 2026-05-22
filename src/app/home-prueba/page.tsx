import React from 'react';
import Link from 'next/link';

export default function HomeHeadersPruebaPage() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', color: '#0f172a', paddingBottom: '100px' }}>
      <style>{`
        * { box-sizing: border-box; }
        .section-title {
          text-align: center;
          padding: 60px 20px 20px;
          font-size: 2rem;
          font-weight: 800;
          color: #1e293b;
        }
        .section-desc {
          text-align: center;
          color: #64748b;
          margin-bottom: 40px;
          font-size: 1.1rem;
        }
        .header-container {
          position: relative;
          height: 400px;
          background-image: url('https://images.unsplash.com/photo-1576013551627-142B28B47C59?q=80&w=2070&auto=format&fit=crop');
          background-size: cover;
          background-position: center;
          margin: 0 40px 40px;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .overlay {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
        }
        
        .btn-cotizar {
          background-color: #0070C0;
          color: white;
          padding: 10px 24px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.95rem;
          text-decoration: none;
          transition: all 0.3s;
          box-shadow: 0 4px 14px 0 rgba(0, 112, 192, 0.39);
          white-space: nowrap;
        }
        .btn-cotizar:hover {
          background-color: #005a9c;
          transform: translateY(-2px);
        }

        .dropdown {
          position: relative;
          display: inline-block;
        }
        .dropdown-content {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          background-color: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(10px);
          min-width: 280px;
          box-shadow: 0px 10px 40px rgba(0,0,0,0.2);
          z-index: 100;
          border-radius: 8px;
          overflow: hidden;
          padding: 8px 0;
          border: 1px solid rgba(0,0,0,0.05);
          transition: opacity 0.3s;
        }
        
        .dropdown:hover .dropdown-content {
          display: block;
        }
        
        .dropdown-item {
          color: #334155;
          padding: 12px 20px;
          text-decoration: none;
          display: block;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s;
          text-align: left;
        }
        .dropdown-item:hover {
          background-color: #f0f9ff;
          color: #0070C0;
          padding-left: 25px;
        }
        .dropdown-divider {
          height: 1px;
          background-color: #e2e8f0;
          margin: 8px 0;
        }

        .nav-link {
          color: white;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.95rem;
          transition: color 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 0;
        }
        
        .nav-link:hover { color: #60a5fa; }

        .nav-link-boutique {
          color: #e2e8f0;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 0.8rem;
          font-weight: 400;
        }
        .nav-link-boutique:hover { color: white; }

        .top-bar {
          background: #0070C0;
          color: white;
          padding: 8px 40px;
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          font-weight: 500;
        }
      `}</style>


      {/* ========================================== */}
      {/* PROPUESTA 1: CORPORATIVO ESTRUCTURADO        */}
      {/* ========================================== */}
      <h2 className="section-title">Opción 1: El Corporativo Estructurado</h2>
      
      <div className="header-container">
        <div className="overlay"></div>
        <header style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '15px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10
        }}>
          <Link href="/"><img src="/logo.jpg" alt="Aquatech" style={{ height: '45px', borderRadius: '4px' }} /></Link>

          <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <Link href="#" className="nav-link">Construcción</Link>
            <Link href="#" className="nav-link">Mantenimiento</Link>
            <Link href="#" className="nav-link">Reparación</Link>
            
            {/* Productos en lugar de Equipamiento */}
            <div className="dropdown">
              <Link href="#" className="nav-link">Productos ▾</Link>
              <div className="dropdown-content">
                <Link href="#" className="dropdown-item">Productos para Construcción</Link>
                <Link href="#" className="dropdown-item">Productos para Mantenimiento</Link>
                <Link href="#" className="dropdown-item">Productos para Reparación</Link>
              </div>
            </div>
            
            <div className="dropdown">
              <Link href="#" className="nav-link">Servicios Especiales ▾</Link>
              <div className="dropdown-content">
                <Link href="#" className="dropdown-item">Piscinas</Link>
                <Link href="#" className="dropdown-item">Saunas</Link>
                <Link href="#" className="dropdown-item">Turcos</Link>
                <Link href="#" className="dropdown-item">Riego Automático</Link>
              </div>
            </div>

            <div className="dropdown">
              <Link href="#" className="nav-link">Explorar ▾</Link>
              <div className="dropdown-content">
                <Link href="#" className="dropdown-item">Portafolio</Link>
                <Link href="#" className="dropdown-item">Blog Orgánico</Link>
                <div className="dropdown-divider"></div>
                <Link href="#" className="dropdown-item">Sucursales</Link>
                <Link href="#" className="dropdown-item">Contacto</Link>
              </div>
            </div>
          </nav>
          <Link href="#" className="btn-cotizar">Cotizador</Link>
        </header>
      </div>


      {/* ========================================== */}
      {/* PROPUESTA 2: BOUTIQUE DE ALTA GAMA           */}
      {/* ========================================== */}
      <h2 className="section-title">Opción 2: Boutique (Logo Centrado)</h2>
      
      <div className="header-container">
        <div className="overlay" style={{ background: 'rgba(0, 0, 0, 0.7)' }}></div>
        <header style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          background: 'transparent', padding: '25px 40px', display: 'grid',
          gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', zIndex: 10
        }}>
          {/* Izquierda */}
          <nav style={{ display: 'flex', gap: '25px', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '40px' }}>
            <Link href="#" className="nav-link nav-link-boutique">Home</Link>
            <Link href="#" className="nav-link nav-link-boutique">Construcción</Link>
            <Link href="#" className="nav-link nav-link-boutique">Mantenimiento</Link>
            <Link href="#" className="nav-link nav-link-boutique">Reparación</Link>
          </nav>

          {/* Centro */}
          <Link href="#" style={{ display: 'flex', justifyContent: 'center' }}>
             <img src="/logo.jpg" alt="Aquatech" style={{ height: '50px', borderRadius: '4px' }} />
          </Link>

          {/* Derecha */}
          <nav style={{ display: 'flex', gap: '25px', alignItems: 'center', paddingLeft: '40px' }}>
            
            <div className="dropdown" style={{ left: 'auto', right: 0 }}>
              <Link href="#" className="nav-link nav-link-boutique">Productos</Link>
              <div className="dropdown-content">
                 <Link href="#" className="dropdown-item">Productos para Construcción</Link>
                 <Link href="#" className="dropdown-item">Productos para Mantenimiento</Link>
                 <Link href="#" className="dropdown-item">Productos para Reparación</Link>
              </div>
            </div>
            
            <div className="dropdown" style={{ left: 'auto', right: 0 }}>
              <Link href="#" className="nav-link nav-link-boutique">Servicios Especiales</Link>
              <div className="dropdown-content">
                 <Link href="#" className="dropdown-item">Piscinas</Link>
                 <Link href="#" className="dropdown-item">Saunas</Link>
                 <Link href="#" className="dropdown-item">Turcos</Link>
                 <Link href="#" className="dropdown-item">Riego Automático</Link>
              </div>
            </div>

            <div className="dropdown" style={{ left: 'auto', right: 0 }}>
              <Link href="#" className="nav-link nav-link-boutique">Más</Link>
              <div className="dropdown-content">
                 <Link href="#" className="dropdown-item">Portafolio</Link>
                 <Link href="#" className="dropdown-item">Blog Orgánico</Link>
                 <Link href="#" className="dropdown-item">Sucursales</Link>
              </div>
            </div>
          </nav>
        </header>
      </div>


      {/* ========================================== */}
      {/* PROPUESTA 3: COMERCIAL FULL UTILITY          */}
      {/* ========================================== */}
      <h2 className="section-title">Opción 3: Comercial Productivo (Top-Bar)</h2>
      
      <div className="header-container" style={{ margin: '0', borderRadius: '0', width: '100%' }}>
        <div className="overlay"></div>
        
        <div className="top-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 11 }}>
          <div style={{ display: 'flex', gap: '30px' }}>
            <span>📍 Loja y Zamora (Sucursales)</span>
            <Link href="#" style={{ color: 'white', textDecoration: 'none' }}>Contacto Directo</Link>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <span>📞 Venta Directa</span>
            <Link href="#" style={{ color: 'white', textDecoration: 'none' }}>Blog Orgánico</Link>
          </div>
        </div>

        <header style={{
          position: 'absolute', top: '35px', left: 0, right: 0,
          background: 'rgba(15, 23, 42, 0.95)', padding: '15px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <Link href="/"><img src="/logo.jpg" alt="Aquatech" style={{ height: '40px', borderRadius: '4px' }} /></Link>

          <nav style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
            <Link href="#" className="nav-link">Construcción</Link>
            <Link href="#" className="nav-link">Mantenimiento</Link>
            <Link href="#" className="nav-link">Reparación</Link>
            
            <div className="dropdown">
              <Link href="#" className="nav-link">Productos ▾</Link>
              <div className="dropdown-content">
                <Link href="#" className="dropdown-item">Productos para Construcción</Link>
                <Link href="#" className="dropdown-item">Productos para Mantenimiento</Link>
                <Link href="#" className="dropdown-item">Productos para Reparación</Link>
              </div>
            </div>
            
            <div className="dropdown">
              <Link href="#" className="nav-link">Servicios Especiales ▾</Link>
              <div className="dropdown-content">
                <Link href="#" className="dropdown-item">Piscinas</Link>
                <Link href="#" className="dropdown-item">Saunas</Link>
                <Link href="#" className="dropdown-item">Turcos</Link>
                <Link href="#" className="dropdown-item">Riego Automático</Link>
              </div>
            </div>

            <Link href="#" className="nav-link">Portafolio</Link>
          </nav>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <Link href="#" className="btn-cotizar">Cotizador</Link>
          </div>
        </header>
      </div>

    </main>
  );
}
