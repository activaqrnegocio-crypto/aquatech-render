'use client'

import React from 'react'
import AgencyLocator from './AgencyLocator'
import FAQSection from './FAQSection'

export default function ContactFAQ() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .c-section { background-color: #FFFFFF; padding-top: 48px; padding-bottom: 64px; border-top: 1px solid #EEEEEE; }
        .c-wrapper { max-width: 1440px; margin: 0 auto; padding: 0 20px; }
        .c-main-grid { display: flex; flex-direction: column; gap: 60px; align-items: stretch; }
        
        @media (min-width: 1024px) {
          .c-section { padding-top: 100px; padding-bottom: 120px; }
          .c-wrapper { padding: 0 40px; }
          .c-main-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 80px; }
        }
      `}} />
      <section id="agencias-faq" className="c-section">
        <div className="c-wrapper">
          <div className="c-main-grid">
            <AgencyLocator />
            <FAQSection />
          </div>
        </div>
      </section>
    </>
  )
}
