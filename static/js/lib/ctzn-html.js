import DOMPurify from '../../vendor/dom-purify.js'

const EL_CLASSES = {
  'H1': 'mb-3 break-words text-3xl font-bold',
  'H2': 'mb-3 break-words text-2xl font-bold',
  'H3': 'mb-3 break-words text-2xl font-medium',
  'H4': 'mb-3 break-words text-xl font-bold',
  'H5': 'mb-3 break-words text-xl font-medium',
  'H6': 'mb-3 break-words text-lg font-bold',
  'P': 'mb-3 break-words',
  'UL': 'mb-3 break-words list-disc',
  'OL': 'mb-3 break-words list-decimal',
  'LI': 'ml-6 break-words',
  'TABLE': 'mb-3 border-collapse',
  'TD': 'border border-gray-300 px-2 py-1 break-words',
  'BLOCKQUOTE': 'mb-3 break-words border-gray-100 border-l-4 border-l-8 pl-4 py-2 text-gray-600',
  'FIGCAPTION': 'mb-3 break-words',
  'PRE': 'mb-3 break-none overflow-x-auto',
  'DL': 'mb-3 break-words',
  'DT': 'font-semibold italic break-words',
  'DD': 'mb-3 pl-6 last:mb-0 break-words',
  'HR': 'my-6 border-gray-300',
  'A': 'text-blue-600 hov:hover:underline',
  'EM': 'italic',
  'I': 'italic',
  'STRONG': 'font-semibold',
  'B': 'font-semibold',
  'CODE': 'bg-gray-100 rounded px-1 py-0.5 break-words',
  'KBD': 'border-b border-gray-500 rounded bg-gray-200 px-1 break-words',
  'LABEL': 'font-medium',
  'BUTTON': 'bg-gray-50 border border-gray-300 px-3 py-1 rounded hov:hover:bg-gray-100',
  'TEXTAREA': 'block border border-gray-300 rounded w-full px-2 py-1',
  'SELECT': 'border border-gray-300 px-1 py-1 rounded hov:hover:bg-gray-50',
}
const INPUT_CLASSES = {
  'text': 'block border border-gray-300 rounded w-full px-2 py-1'
}

DOMPurify.addHook('beforeSanitizeElements', currentNode => {
  if (currentNode.tagName === 'CTZN-CODE') {
    // turn everything inside a <ctzn-code> into escaped rendering
    currentNode.textContent = currentNode.innerHTML
  }
  return currentNode;
})

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
        'ctzn-code',
        'ctzn-iframe',
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
      FORBID_TAGS: ['form', 'style'],
      FORBID_ATTR: ['class', 'style']
    })
  }
  if (context === 'post') {
    return DOMPurify.sanitize(str, {
      ADD_TAGS: [
        'ctzn-card',
        'ctzn-iframe',
        'ctzn-code',
        'ctzn-post-view'
      ],
      ADD_ATTR: ['view', 'user-id', 'mode'],
      FORBID_TAGS: ['form', 'style'],
      FORBID_ATTR: ['class', 'style']
    })
  }
  return DOMPurify.sanitize(str, {
    FORBID_TAGS: ['form', 'style'],
    FORBID_ATTR: ['class', 'style']
  })
}