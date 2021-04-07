import DOMPurify from '../../vendor/dom-purify.js'

const EL_CLASSES = {
  'H1': 'mb-3 text-3xl font-bold',
  'H2': 'mb-3 text-2xl font-bold',
  'H3': 'mb-3 text-2xl font-medium',
  'H4': 'mb-3 text-xl font-bold',
  'H5': 'mb-3 text-xl font-medium',
  'H6': 'mb-3 text-lg font-bold',
  'P': 'mb-3',
  'UL': 'mb-3 list-disc',
  'OL': 'mb-3 list-decimal',
  'LI': 'ml-6',
  'TABLE': 'mb-3 border-collapse',
  'TD': 'border border-gray-300 px-2 py-1',
  'BLOCKQUOTE': 'mb-3 border-gray-100 border-l-4 border-l-8 pl-4 py-2 text-gray-600',
  'FIGCAPTION': 'mb-3',
  'PRE': 'mb-3',
  'DT': 'font-semibold italic',
  'DD': 'mb-3 pl-6',
  'HR': 'my-6 border-gray-300',
  'A': 'text-blue-600 hov:hover:underline',
  'EM': 'italic',
  'I': 'italic',
  'STRONG': 'font-semibold',
  'B': 'font-semibold',
  'CODE': 'bg-gray-100 rounded px-1 py-0.5',
  'KBD': 'border-b border-gray-500 rounded bg-gray-200 px-1',
  'LABEL': 'font-medium',
  'BUTTON': 'bg-gray-50 border border-gray-300 px-3 py-1 rounded hov:hover:bg-gray-100',
  'TEXTAREA': 'block border border-gray-300 rounded w-full px-2 py-1',
  'SELECT': 'border border-gray-300 px-1 py-1 rounded hov:hover:bg-gray-50',
}
const INPUT_CLASSES = {
  'text': 'block border border-gray-300 rounded w-full px-2 py-1'
}

DOMPurify.addHook('afterSanitizeAttributes', currentNode => {
  if (currentNode.tagName in EL_CLASSES) {
    currentNode.className = EL_CLASSES[currentNode.tagName]
  } else if (currentNode.tagName === 'INPUT') {
    if (currentNode.getAttribute('type') in INPUT_CLASSES){
      currentNode.className = INPUT_CLASSES[currentNode.getAttribute('type')]
    }
  }
  return currentNode;
})

export function sanitize (str, context = undefined) {
  if (context === 'profile') {
    return DOMPurify.sanitize(str, {
      ADD_TAGS: [
        'ctzn-card',
        'ctzn-posts-feed',
        'ctzn-post-view',
        'ctzn-followers-list',
        'ctzn-following-list',
        'ctzn-community-memberships-list',
        'ctzn-community-members-list',
        'ctzn-dbmethods-feed',
        'ctzn-owned-items-list',
        'ctzn-item-classes-list'
      ],
      ADD_ATTR: ['view', 'user-id', 'mode', 'methods-filter'],
      FORBID_TAGS: ['style'],
      FORBID_ATTR: ['class', 'style']
    })
  }
  return DOMPurify.sanitize(str, {
    FORBID_TAGS: ['style'],
    FORBID_ATTR: ['class', 'style']
  })
}