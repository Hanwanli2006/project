import { visit } from 'unist-util-visit'

// 让行内公式 $...$ 自动加上 \displaystyle，行内分数分子分母不再被缩成小号
// 已带 \displaystyle 的跳过，避免重复
export default function remarkDisplayInlineMath() {
  return (tree) => {
    visit(tree, 'inlineMath', (node) => {
      if (node.value && !node.value.includes('\\displaystyle')) {
        node.value = '\\displaystyle ' + node.value
      }
    })
  }
}
