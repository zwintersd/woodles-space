export type NotebookMode = 'notes' | 'tasks' | 'ideas';

export type Note = {
	id: string;
	title: string;
	body: string;
	tags: string[];
	updatedAt: string;
	createdAt: string;
};

export type NotebookTask = {
	id: string;
	title: string;
	status: 'open' | 'done';
	priority: 'low' | 'normal' | 'high';
	noteId?: string;
	createdAt: string;
	completedAt?: string;
};

export type Idea = {
	id: string;
	text: string;
	lane: 'spark' | 'shape' | 'later';
	createdAt: string;
};
