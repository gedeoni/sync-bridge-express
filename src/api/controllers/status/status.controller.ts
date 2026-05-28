import { Request, Response, NextFunction } from 'express';
import { responseWrapper } from '../../../helpers/responseWrapper';
import httpCodes from '../../../constants/httpCodes';
import { customerRepository, sequelize } from '../../../databases/sequelize';
import { logger } from '../../../helpers/logger';

export class StatusController {
  /**
   * GET /
   * @summary Health Check
   * @tags Status
   * @return {object} 200 - Service is healthy
   * @return {object} 503 - Service is unhealthy
   */
  public checkStatus = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      await sequelize.authenticate();
      logger.info('Database connection has been established successfully.');

      // Check read operation
      const readCheck = await this.checkReadOperation();
      // Check write operation
      const writeCheck = await this.checkWriteOperation();

      if (readCheck && writeCheck) {
        responseWrapper({
          res,
          status: httpCodes.OK,
          message: 'Service is healthy',
          data: {
            read: readCheck,
            write: writeCheck,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      logger.error('Health check failed:', error);
      responseWrapper({
        res,
        status: httpCodes.SERVICE_UNAVAILABLE,
        message: 'Service is unhealthy',
        data: {
          read: false,
          write: false,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };

  /**
   * Checks if the application can read from the database
   * @returns Promise<boolean>
   */
  private async checkReadOperation(): Promise<boolean> {
    try {
      // Attempt to read a record from the customer table
      await customerRepository.findOne({
        attributes: ['id'],
      });
      return true;
    } catch (error) {
      logger.error('Read operation check failed:', error);
      throw new Error('Database read operation failed');
    }
  }

  /**
   * Checks if the application can write to the database
   * @returns Promise<boolean>
   */
  private async checkWriteOperation(): Promise<boolean> {
    const transaction = await sequelize.transaction();
    try {
      // Create a temporary record
      const tempRecord = await customerRepository.create(
        {
          email: 'healthcheck@example.com',
          first_name: 'Health',
          last_name: 'Check',
        },
        { transaction }
      );

      // Delete the temporary record
      await tempRecord.destroy({ transaction });

      await transaction.commit();

      return true;
    } catch (error) {
      await transaction.rollback();
      logger.error('Write operation check failed:', error);
      throw new Error('Database write operation failed');
    }
  }
}
