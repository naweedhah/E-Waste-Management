import { GraphQLError, Kind } from 'graphql';

/**
 * Rejects queries nested deeper than `maxDepth` before they execute, so a client cannot send a
 * pathological query that fans out into thousands of database lookups.
 */
export const depthLimit = (maxDepth) => (context) => {
  const fragments = Object.fromEntries(
    context
      .getDocument()
      .definitions.filter((d) => d.kind === Kind.FRAGMENT_DEFINITION)
      .map((d) => [d.name.value, d]),
  );

  const depthOf = (node, depth, seen) => {
    if (!node.selectionSet) return depth;
    return Math.max(
      depth,
      ...node.selectionSet.selections.map((sel) => {
        if (sel.kind === Kind.FRAGMENT_SPREAD) {
          if (seen.has(sel.name.value)) return depth;
          const fragment = fragments[sel.name.value];
          return fragment ? depthOf(fragment, depth, new Set([...seen, sel.name.value])) : depth;
        }
        if (sel.kind === Kind.INLINE_FRAGMENT) return depthOf(sel, depth, seen);
        // Introspection fields don't count.
        if (sel.name.value.startsWith('__')) return depth;
        return depthOf(sel, depth + 1, seen);
      }),
    );
  };

  return {
    OperationDefinition(node) {
      const depth = depthOf(node, 0, new Set());
      if (depth > maxDepth) {
        context.reportError(
          new GraphQLError(`Query is too deep (${depth} levels, maximum is ${maxDepth}).`, {
            nodes: [node],
            extensions: { code: 'QUERY_TOO_DEEP' },
          }),
        );
      }
    },
  };
};
