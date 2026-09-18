/**
 * Test Fixtures for Database Seeding
 *
 * This module provides type-safe test data fixtures for use in tests.
 * These fixtures can be used with convex-test for backend testing
 * or for mocking data in component tests.
 *
 * @module tests/fixtures/data
 */

export interface ProjectFixture {
  name: string;
  description: string;
  ownerId: string;
  createdAt: number;
}

export interface TaskFixture {
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  projectId: string;
  ownerId: string;
  createdAt: number;
}

export interface UploadFixture {
  storageId: string;
  name: string;
  contentType: string;
  size: number;
  ownerId: string;
  createdAt: number;
}

export const testOwners = {
  alice: "test-user-alice",
  bob: "test-user-bob",
  charlie: "test-user-charlie",
} as const;

export const projectFixtures: ProjectFixture[] = [
  {
    name: "Website Redesign",
    description: "Redesign the marketing website with new brand guidelines",
    ownerId: testOwners.alice,
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    name: "Mobile App",
    description: "Build a cross-platform mobile app",
    ownerId: testOwners.alice,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    name: "API Layer",
    description: "Design and implement the REST API",
    ownerId: testOwners.bob,
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
];

export const taskFixtures: TaskFixture[] = [
  {
    title: "Design landing page",
    description: "Create wireframes and mockups for the new landing page",
    status: "todo",
    projectId: "placeholder-project-1",
    ownerId: testOwners.alice,
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    title: "Set up CI pipeline",
    description: "Configure GitHub Actions for automated testing",
    status: "in_progress",
    projectId: "placeholder-project-1",
    ownerId: testOwners.alice,
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    title: "Write auth tests",
    description: "Unit and integration tests for authentication",
    status: "done",
    projectId: "placeholder-project-1",
    ownerId: testOwners.alice,
    createdAt: Date.now(),
  },
];

export const uploadFixtures: UploadFixture[] = [
  {
    storageId: "storage-id-1",
    name: "profile-photo.jpg",
    contentType: "image/jpeg",
    size: 1024 * 100,
    ownerId: testOwners.alice,
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    storageId: "storage-id-2",
    name: "document.pdf",
    contentType: "application/pdf",
    size: 1024 * 500,
    ownerId: testOwners.bob,
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
];

export const createProject = (
  overrides: Partial<ProjectFixture> = {}
): ProjectFixture => ({
  name: "Test Project",
  description: "A test project for automated testing",
  ownerId: testOwners.alice,
  createdAt: Date.now(),
  ...overrides,
});

export const createTask = (
  overrides: Partial<TaskFixture> = {}
): TaskFixture => ({
  title: "Test Task",
  description: "A test task for automated testing",
  status: "todo",
  projectId: "placeholder-project",
  ownerId: testOwners.alice,
  createdAt: Date.now(),
  ...overrides,
});

export const createUpload = (
  overrides: Partial<UploadFixture> = {}
): UploadFixture => ({
  storageId: `storage-id-${Date.now()}`,
  name: "test-file.txt",
  contentType: "text/plain",
  size: 1024,
  ownerId: testOwners.alice,
  createdAt: Date.now(),
  ...overrides,
});

export const createManyTasks = (
  count: number,
  ownerId: string = testOwners.alice,
  projectId: string = "placeholder-project"
): TaskFixture[] => {
  return Array.from({ length: count }, (_, i) =>
    createTask({
      title: `Task ${i + 1}`,
      description: `Description for task ${i + 1}`,
      ownerId,
      projectId,
      createdAt: Date.now() - i * 60 * 60 * 1000,
    })
  );
};

export const scenarios = {
  empty: {
    projects: [] as ProjectFixture[],
    tasks: [] as TaskFixture[],
    uploads: [] as UploadFixture[],
  },

  singleUser: {
    projects: projectFixtures.filter((p) => p.ownerId === testOwners.alice),
    tasks: taskFixtures.filter((t) => t.ownerId === testOwners.alice),
    uploads: uploadFixtures.filter((u) => u.ownerId === testOwners.alice),
  },

  multiUser: {
    projects: projectFixtures,
    tasks: taskFixtures,
    uploads: uploadFixtures,
  },

  allStatuses: {
    tasks: [
      createTask({ status: "todo", title: "To Do Task" }),
      createTask({ status: "in_progress", title: "In Progress Task" }),
      createTask({ status: "done", title: "Done Task" }),
    ],
  },

  pagination: {
    tasks: createManyTasks(50),
  },
};
