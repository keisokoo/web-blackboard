type Blackboard = {
    name: string;
    description: string;
    url: string;
    tags: string[];
    isPublic: boolean;
    isFavorite: boolean;
    isPinned: boolean;
    isArchived: boolean;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
};
declare function createBlackboard(options: Partial<Blackboard>): void;
export default createBlackboard;
