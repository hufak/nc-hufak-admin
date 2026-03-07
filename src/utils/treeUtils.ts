import type { SharedMailboxNode } from '../types';

let sharedMailboxNodeId = 0;

function nextSharedMailboxNodeId(): string {
	sharedMailboxNodeId += 1;
	return `shared-mailbox-node-${sharedMailboxNodeId}`;
}

function objectToTreeNodes(value: unknown): SharedMailboxNode[] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return [];
	}

	return Object.entries(value).map(([key, childValue]) => {
		if (childValue && typeof childValue === 'object' && !Array.isArray(childValue)) {
			return {
				id: nextSharedMailboxNodeId(),
				key,
				type: 'object',
				children: objectToTreeNodes(childValue),
			};
		}

		return {
			id: nextSharedMailboxNodeId(),
			key,
			type: 'value',
			value: childValue == null ? '' : String(childValue),
		};
	}) as SharedMailboxNode[];
}

function treeNodesToObject(nodes: SharedMailboxNode[]): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	nodes.forEach((node) => {
		if (!node?.key) {
			return;
		}
		if (node.type === 'object') {
			result[node.key] = treeNodesToObject(node.children || []);
		} else {
			result[node.key] = node.value ?? '';
		}
	});
	return result;
}

function updateTreeNode(
	nodes: SharedMailboxNode[],
	targetId: string,
	updater: (node: SharedMailboxNode) => SharedMailboxNode,
): SharedMailboxNode[] {
	return nodes.map((node) => {
		if (node.id === targetId) {
			return updater(node);
		}
		if (node.type === 'object' && Array.isArray(node.children)) {
			return {
				...node,
				children: updateTreeNode(node.children, targetId, updater),
			};
		}
		return node;
	});
}

export { objectToTreeNodes, treeNodesToObject, updateTreeNode };
