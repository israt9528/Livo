-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "units" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
