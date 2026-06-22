1. 维护原始协议
2. surface管理
3. 组件节点 -> hydrateNodeMap(把每个组件的key打平)
4. error信息

interface A2UIStore {
surfaceMap: <record, SurFace>,
HydrateNodeMap: <record, HyDrateNode>
}

interface SurFace {
surfaceId: String,
beginrender: Bool,
rootNode: // 指针，指向某一个HtDrateNode
}

interface HyDrateNode {
componentId：string,
\_vnode: reactElement,
ownerSurfaceId: string,
protocal: string(JSOnLine协议)
}

enum ErrorType = {
PARE_ERROR,
}

interface Error {
type: ErrorType,
content: string
}

每个实体的更新、删除、查找、添加（by id 梯度）

const reactElement = {
TextFile: (props:{test}) => {
<div>{test}</div>  
 }
}

// 为提升效率，都是用空间换时间，所以都是通过map，在parser的时候，构建的时候需要的信息一次性维护好

store里面还有对surfaceMap，HydrateNodeMap，ErrorMap的更新，删除，查找添加操作

为了解除对react的依赖
store通过zustand/vanilla 实现状态管理
store是一个全局单例，需要导出一个方法可以拿到store实例
