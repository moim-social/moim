declare module "pg" {
  export class Pool {
    constructor(config?: { connectionString?: string });
  }

  const pg: {
    Pool: typeof Pool;
  };

  export default pg;
}
