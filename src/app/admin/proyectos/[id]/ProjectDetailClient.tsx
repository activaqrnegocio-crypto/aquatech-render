'use client'

// v373: Wrapper delgado — Admin llama al componente base unificado  
import ProjectDetailBase from '@/components/project/ProjectDetailBase'

export default function ProjectDetailClient({ project: initialProject, availableOperators = [] }: any) {
  return (
    <ProjectDetailBase
      project={initialProject}
      availableOperators={availableOperators}
      role="admin"
    />
  )
}
