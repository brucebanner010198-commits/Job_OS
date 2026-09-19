export interface LearningResource {
  title: string;
  url: string;
  type: "doc" | "course" | "interactive" | "repo";
  practiceProject?: string;
  estimatedHours?: number;
}

export interface SkillResourceEntry {
  keywords: string[];
  resources: LearningResource[];
}

export const CURATED_SKILL_REGISTRY: Record<string, SkillResourceEntry> = {
  docker: {
    keywords: ["docker", "container", "containers", "dockerfile", "docker-compose"],
    resources: [
      {
        title: "Docker Official Get Started Guide",
        url: "https://docs.docker.com/get-started/",
        type: "doc",
        practiceProject: "Containerize a Next.js or Node app with multi-stage build reducing image size under 100MB.",
        estimatedHours: 3,
      },
      {
        title: "Play with Docker (Free interactive classroom)",
        url: "https://labs.play-with-docker.com/",
        type: "interactive",
      },
    ],
  },
  kubernetes: {
    keywords: ["kubernetes", "k8s", "helm", "kubectl"],
    resources: [
      {
        title: "Kubernetes Interactive Tutorials",
        url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/",
        type: "interactive",
        practiceProject: "Deploy a microservice with rolling updates, liveness probes, and a Helm chart on Minikube.",
        estimatedHours: 6,
      },
      {
        title: "K8s by Example",
        url: "https://k8sbyexample.com/",
        type: "doc",
      },
    ],
  },
  typescript: {
    keywords: ["typescript", "ts", "types"],
    resources: [
      {
        title: "TypeScript for Professional Programmers (Official Handbook)",
        url: "https://www.typescriptlang.org/docs/handbook/intro.html",
        type: "doc",
        practiceProject: "Refactor an untyped JavaScript utility library to strict TypeScript with generic constraints.",
        estimatedHours: 4,
      },
      {
        title: "Total TypeScript (Free beginner and advanced exercises)",
        url: "https://www.totaltypescript.com/tutorials",
        type: "interactive",
      },
    ],
  },
  react: {
    keywords: ["react", "reactjs", "react.js", "hooks"],
    resources: [
      {
        title: "React Official Documentation & Interactive Sandbox",
        url: "https://react.dev/learn",
        type: "doc",
        practiceProject: "Build an optimistic UI dashboard with useActionState, useOptimistic, and Server Components.",
        estimatedHours: 5,
      },
    ],
  },
  nextjs: {
    keywords: ["next.js", "nextjs", "next 15", "next 16", "app router"],
    resources: [
      {
        title: "Learn Next.js (Official interactive course)",
        url: "https://nextjs.org/learn",
        type: "course",
        practiceProject: "Create a server-action-powered CRUD app with streaming SSR and Suspense boundaries.",
        estimatedHours: 5,
      },
    ],
  },
  python: {
    keywords: ["python", "python3", "pytest", "fastapi"],
    resources: [
      {
        title: "FastAPI Official Tutorial",
        url: "https://fastapi.tiangolo.com/tutorial/",
        type: "doc",
        practiceProject: "Build an asynchronous REST API with Pydantic validation, JWT authentication, and automated OpenAPI docs.",
        estimatedHours: 4,
      },
    ],
  },
  go: {
    keywords: ["go", "golang", "goroutines", "gin"],
    resources: [
      {
        title: "A Tour of Go (Interactive)",
        url: "https://go.dev/tour/",
        type: "interactive",
        practiceProject: "Build a concurrent worker pool pipeline with channels and context cancellation.",
        estimatedHours: 4,
      },
      {
        title: "Learn Go with Tests",
        url: "https://quii.gitbook.io/learn-go-with-tests/",
        type: "doc",
      },
    ],
  },
  rust: {
    keywords: ["rust", "cargo", "tokio", "actix"],
    resources: [
      {
        title: "The Rust Programming Language (The Book)",
        url: "https://doc.rust-lang.org/book/",
        type: "doc",
        practiceProject: "Build a CLI search tool with memory-efficient streaming and zero-cost iterators.",
        estimatedHours: 8,
      },
      {
        title: "Rustlings (Hands-on interactive exercises)",
        url: "https://github.com/rust-lang/rustlings",
        type: "repo",
      },
    ],
  },
  graphql: {
    keywords: ["graphql", "apollo", "schema", "resolver"],
    resources: [
      {
        title: "How to GraphQL (Fullstack tutorial)",
        url: "https://www.howtographql.com/",
        type: "course",
        practiceProject: "Implement a federated GraphQL gateway with query complexity cost analysis and DataLoader caching.",
        estimatedHours: 5,
      },
    ],
  },
  redis: {
    keywords: ["redis", "cache", "caching", "pubsub"],
    resources: [
      {
        title: "Redis University (Free courses)",
        url: "https://university.redis.com/",
        type: "course",
        practiceProject: "Build a distributed sliding-window rate limiter using Redis Lua scripts.",
        estimatedHours: 3,
      },
    ],
  },
  kafka: {
    keywords: ["kafka", "event streaming", "event-driven", "pub/sub"],
    resources: [
      {
        title: "Confluent Kafka Developer Tutorials",
        url: "https://developer.confluent.io/get-started/",
        type: "doc",
        practiceProject: "Build an idempotent consumer-producer event processing loop with dead letter queues.",
        estimatedHours: 6,
      },
    ],
  },
  aws: {
    keywords: ["aws", "amazon web services", "s3", "lambda", "ecs", "ec2"],
    resources: [
      {
        title: "AWS Skill Builder (Free digital training)",
        url: "https://explore.skillbuilder.aws/",
        type: "course",
        practiceProject: "Deploy an infrastructure stack using AWS CDK or Terraform with IAM least-privilege roles.",
        estimatedHours: 6,
      },
    ],
  },
  sql: {
    keywords: ["sql", "postgresql", "postgres", "indexing", "queries"],
    resources: [
      {
        title: "Use The Index, Luke! (SQL indexing guide)",
        url: "https://use-the-index-luke.com/",
        type: "doc",
        practiceProject: "Analyze and optimize slow queries using EXPLAIN ANALYZE, partial indexes, and B-tree heuristics.",
        estimatedHours: 4,
      },
      {
        title: "PostgreSQL Exercises (Interactive)",
        url: "https://pgexercises.com/",
        type: "interactive",
      },
    ],
  },
  system_design: {
    keywords: ["system design", "distributed systems", "scalability", "microservices"],
    resources: [
      {
        title: "System Design Primer (GitHub)",
        url: "https://github.com/donnemartin/system-design-primer",
        type: "repo",
        practiceProject: "Write an architecture decision record (ADR) comparing event-driven vs synchronous RPC with trade-offs.",
        estimatedHours: 8,
      },
    ],
  },
};

/**
 * Finds high-yield learning resources for any given skill keyword.
 * Uses exact registry matching first, then falls back to reliable devdocs / MDN search.
 */
export function getResourcesForSkill(skillName: string): LearningResource[] {
  const norm = skillName.toLowerCase().trim();

  for (const [key, entry] of Object.entries(CURATED_SKILL_REGISTRY)) {
    if (key === norm || entry.keywords.some((k) => norm.includes(k) || k.includes(norm))) {
      return entry.resources;
    }
  }

  // Dynamic fallback for any technology
  const encoded = encodeURIComponent(skillName);
  return [
    {
      title: `${skillName} Documentation & Guides`,
      url: `https://devdocs.io/#q=${encoded}`,
      type: "doc",
      practiceProject: `Build a small proof-of-concept integrating ${skillName} and record your learnings in your work journal.`,
      estimatedHours: 3,
    },
    {
      title: `${skillName} on GitHub (Popular Repositories & Implementations)`,
      url: `https://github.com/topics/${encodeURIComponent(skillName.toLowerCase().replace(/\s+/g, "-"))}`,
      type: "repo",
    },
  ];
}
