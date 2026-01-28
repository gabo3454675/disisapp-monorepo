import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { ActiveOrganization } from '@/common/decorators/active-organization.decorator';

@Controller('expenses')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(
    @Body() createExpenseDto: CreateExpenseDto,
    @ActiveOrganization() organizationId: number,
  ) {
    return this.expensesService.create(createExpenseDto, organizationId);
  }

  @Get()
  findAll(@ActiveOrganization() organizationId: number) {
    return this.expensesService.findAll(organizationId);
  }

  @Get('stats')
  getStats(@ActiveOrganization() organizationId: number) {
    return this.expensesService.getStats(organizationId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @ActiveOrganization() organizationId: number,
  ) {
    return this.expensesService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateExpenseDto: UpdateExpenseDto,
    @ActiveOrganization() organizationId: number,
  ) {
    return this.expensesService.update(id, updateExpenseDto, organizationId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @ActiveOrganization() organizationId: number,
  ) {
    return this.expensesService.remove(id, organizationId);
  }
}
